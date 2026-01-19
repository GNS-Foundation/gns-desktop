package com.gcrumbs.browser

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log

class GnsHceService : HostApduService() {

    companion object {
        const val TAG = "GnsHceService"
        // GNS Protocol AID: F0010203040506
        const val GNS_AID = "F0010203040506"
        // APDU Command: SELECT AID
        val SELECT_APDU_HEADER = byteArrayOf(0x00.toByte(), 0xA4.toByte(), 0x04.toByte(), 0x00.toByte())
        // Responses
        val STATUS_SUCCESS = byteArrayOf(0x90.toByte(), 0x00.toByte())
        val STATUS_FAILED = byteArrayOf(0x6F.toByte(), 0x00.toByte())
        val RESPONSE_HELLO = "Hello from Tauri GNS!".toByteArray()
    }

    override fun processCommandApdu(commandApdu: ByteArray, extras: Bundle?): ByteArray {
        Log.d(TAG, "Received APDU: " + ByteArrayToHexString(commandApdu))

        // Check if this is a SELECT command (the only one we handle for now)
        if (isSelectCommand(commandApdu)) {
             Log.d(TAG, "GNS AID Selected!")
             return RESPONSE_HELLO + STATUS_SUCCESS
        }

        return STATUS_FAILED
    }

    override fun onDeactivated(reason: Int) {
        Log.d(TAG, "Deactivated: $reason")
    }

    private fun isSelectCommand(apdu: ByteArray): Boolean {
        if (apdu.size < SELECT_APDU_HEADER.size) return false
        
        for (i in SELECT_APDU_HEADER.indices) {
            if (apdu[i] != SELECT_APDU_HEADER[i]) return false
        }
        return true
    }

    private fun ByteArrayToHexString(bytes: ByteArray): String {
        val hexArray = charArrayOf('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F')
        val hexChars = CharArray(bytes.size * 2)
        var v: Int
        for (j in bytes.indices) {
            v = bytes[j].toInt() and 0xFF
            hexChars[j * 2] = hexArray[v ushr 4]
            hexChars[j * 2 + 1] = hexArray[v and 0x0F]
        }
        return String(hexChars)
    }
}
