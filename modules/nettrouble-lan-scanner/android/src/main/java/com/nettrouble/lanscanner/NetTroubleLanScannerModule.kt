package com.nettrouble.lanscanner

import android.content.Context
import android.net.DhcpInfo
import android.net.wifi.WifiManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import kotlin.math.min

class NetTroubleLanScannerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NetTroubleLanScanner")

    AsyncFunction("getCurrentNetwork") {
      currentNetworkInfo()
    }

    AsyncFunction("scan") { target: String, limit: Int, portsText: String ->
      val targets = parseTargets(target, limit.coerceIn(1, 512))
      val ports = portsText
        .split(",")
        .mapNotNull { it.trim().toIntOrNull() }
        .filter { it in 1..65535 }
        .ifEmpty { listOf(80, 443, 8080) }
      targets.map { ip ->
        val start = System.currentTimeMillis()
        var reachable = false
        val openPorts = mutableListOf<Int>()
        try {
          reachable = InetAddress.getByName(ip).isReachable(250)
        } catch (_: Exception) {}
        if (!reachable) {
          reachable = pingHost(ip, 300)
        }

        for (port in ports) {
          if (isTcpOpen(ip, port, 180)) {
            reachable = true
            openPorts.add(port)
          }
        }

        val arp = readNeighborMap()
        val mac = arp[ip].orEmpty()
        val vendor = vendorFor(mac)
        mapOf(
          "IP" to ip,
          "Status" to if (reachable) "Reachable" else "No response",
          "Response Time" to "${System.currentTimeMillis() - start} ms",
          "Open Ports" to if (openPorts.isEmpty()) "-" else openPorts.joinToString(", "),
          "MAC" to (mac.ifBlank { "Unavailable" }),
          "Vendor" to (vendor.ifBlank { "Unavailable" }),
          "Method" to "Native Android"
        )
      }
    }
  }

  private fun isTcpOpen(ip: String, port: Int, timeoutMs: Int): Boolean {
    return try {
      Socket().use { socket ->
        socket.connect(InetSocketAddress(ip, port), timeoutMs)
      }
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun pingHost(ip: String, timeoutMs: Int): Boolean {
    return try {
      val timeoutSeconds = if (timeoutMs <= 1000) 1 else (timeoutMs / 1000)
      val process = ProcessBuilder("/system/bin/ping", "-c", "1", "-W", timeoutSeconds.toString(), ip)
        .redirectErrorStream(true)
        .start()
      process.waitFor().let { it == 0 }
    } catch (_: Exception) {
      false
    }
  }

  private fun currentNetworkInfo(): Map<String, Any?> {
    return try {
      val context = appContext.reactContext ?: return emptyMap()
      val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return emptyMap()
      val connection = wifi.connectionInfo ?: return emptyMap()
      val dhcp = wifi.dhcpInfo ?: DhcpInfo()
      val ip = littleEndianIpv4(connection.ipAddress)
      if (ip == "0.0.0.0") return emptyMap()

      val maskLong = if (dhcp.netmask != 0) littleEndianIntToLong(dhcp.netmask) else guessMask(ip)
      val cidr = cidrFromMask(maskLong)
      val ipLong = ipv4ToLong(ip) ?: return emptyMap()
      val network = ipLong and maskLong
      val wildcard = maskLong.inv() and 0xffffffffL
      val first = if (cidr >= 31) network else network + 1
      val last = if (cidr >= 31) network or wildcard else (network or wildcard) - 1
      mapOf(
        "ip" to ip,
        "cidr" to cidr,
        "subnet" to "${longToIpv4(network)}/$cidr",
        "range" to "${longToIpv4(first)}-${longToIpv4(last)}",
        "gateway" to if (dhcp.gateway != 0) littleEndianIpv4(dhcp.gateway) else "",
        "ssid" to connection.ssid.orEmpty().trim('"')
      )
    } catch (_: Exception) {
      emptyMap()
    }
  }

  private fun littleEndianIpv4(value: Int): String {
    val longValue = littleEndianIntToLong(value)
    return longToIpv4(longValue)
  }

  private fun littleEndianIntToLong(value: Int): Long {
    return ((value and 0xff).toLong() shl 24) or
      ((value shr 8 and 0xff).toLong() shl 16) or
      ((value shr 16 and 0xff).toLong() shl 8) or
      ((value shr 24 and 0xff).toLong())
  }

  private fun cidrFromMask(mask: Long): Int {
    return java.lang.Long.bitCount(mask and 0xffffffffL)
  }

  private fun guessMask(ip: String): Long {
    return when (ip.substringBefore(".").toIntOrNull() ?: 0) {
      in 1..126 -> 0xff000000L
      in 128..191 -> 0xffff0000L
      else -> 0xffffff00L
    }
  }

  private fun parseTargets(value: String, limit: Int): List<String> {
    val cleaned = value.trim()
    if (ipv4ToLong(cleaned) != null) {
      return listOf(cleaned)
    }
    if (cleaned.contains("-")) {
      val parts = cleaned.split("-", limit = 2).map { it.trim() }
      val start = ipv4ToLong(parts.getOrNull(0) ?: return emptyList()) ?: return emptyList()
      val end = ipv4ToLong(parts.getOrNull(1) ?: return emptyList()) ?: return emptyList()
      if (end < start) return emptyList()
      val count = min((end - start + 1).toInt(), limit)
      return (0 until count).map { longToIpv4(start + it) }
    }

    val cidrParts = cleaned.split("/", limit = 2)
    val ip = ipv4ToLong(cidrParts.getOrNull(0) ?: return emptyList()) ?: return emptyList()
    val cidr = cidrParts.getOrNull(1)?.toIntOrNull() ?: return emptyList()
    if (cidr !in 0..32) return emptyList()
    val mask = if (cidr == 0) 0L else (0xffffffffL shl (32 - cidr)) and 0xffffffffL
    val network = ip and mask
    val wildcard = mask.inv() and 0xffffffffL
    val first = if (cidr >= 31) network else network + 1
    val last = if (cidr >= 31) network or wildcard else (network or wildcard) - 1
    if (last < first) return emptyList()
    val count = min((last - first + 1).toInt(), limit)
    return (0 until count).map { longToIpv4(first + it) }
  }

  private fun ipv4ToLong(ip: String): Long? {
    val parts = ip.split(".")
    if (parts.size != 4) return null
    var out = 0L
    for (part in parts) {
      val n = part.toIntOrNull() ?: return null
      if (n !in 0..255) return null
      out = (out shl 8) + n
    }
    return out and 0xffffffffL
  }

  private fun longToIpv4(value: Long): String {
    return listOf(24, 16, 8, 0).joinToString(".") { shift ->
      ((value shr shift) and 255).toString()
    }
  }

  private fun readNeighborMap(): Map<String, String> {
    val result = mutableMapOf<String, String>()
    try {
      val arpFile = File("/proc/net/arp")
      if (arpFile.exists()) {
        arpFile.readLines().drop(1).forEach { line ->
          val parts = line.trim().split(Regex("\\s+"))
          if (parts.size >= 4 && parts[3].matches(Regex("(?i)([0-9a-f]{2}:){5}[0-9a-f]{2}"))) {
            result[parts[0]] = parts[3].uppercase()
          }
        }
      }
    } catch (_: Exception) {}

    try {
      val neighFile = File("/proc/net/ndisc_cache")
      if (neighFile.exists()) {
        neighFile.readLines().forEach { line ->
          val parts = line.trim().split(Regex("\\s+"))
          val ip = parts.firstOrNull { it.matches(Regex("(\\d{1,3}\\.){3}\\d{1,3}")) }
          val mac = parts.firstOrNull { it.matches(Regex("(?i)([0-9a-f]{2}:){5}[0-9a-f]{2}")) }
          if (ip != null && mac != null) result[ip] = mac.uppercase()
        }
      }
    } catch (_: Exception) {}

    return result
  }

  private fun vendorFor(mac: String): String {
    if (mac.length < 8) return ""
    val oui = mac.take(8).uppercase()
    return vendorMap[oui].orEmpty()
  }

  private val vendorMap = mapOf(
    "00:00:0C" to "Cisco Systems",
    "00:1A:1E" to "Aruba Networks",
    "3C:A8:2A" to "HPE / Aruba",
    "F8:B1:56" to "Cisco Meraki",
    "00:09:0F" to "Fortinet",
    "00:50:56" to "VMware",
    "00:14:22" to "Dell",
    "00:1B:21" to "Intel",
    "00:10:18" to "Broadcom",
    "E4:5D:52" to "Avaya",
    "B8:27:EB" to "Raspberry Pi",
    "DC:A6:32" to "Raspberry Pi",
    "FC:FB:FB" to "Ubiquiti",
    "78:8A:20" to "Ubiquiti",
    "00:11:32" to "Synology",
    "00:08:9B" to "ICP Electronics"
  )
}
