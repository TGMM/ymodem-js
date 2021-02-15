import bufferChunks = require("buffer-chunks");
import * as SerialPort from "serialport";
import { CRC } from "crc-full";
import { YModemDelays } from "./ymodem-delays";
import { YModemLogger } from "./ymodem-logger";
import { SimpleLogger } from "./simple-logger";

type SendType = 0x01 | 0x02;
const SendSize = {
    0x01: 128,
    0x02: 1024,
};

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const DebugDict: Record<number, string> = {
    0x01: "SOH",
    0x02: "STX",
    0x04: "EOT",
    0x06: "ACK",
    0x15: "NAL",
    0x18: "CAN",
    0x43: "C",
    0x1a: "PADDING",
};

export class YModem {
    static SOH: SendType = 0x01;
    static STX: SendType = 0x02;
    static EOT = 0x04;
    static ACK = 0x06;
    static NAK = 0x15;
    static CAN = 0x18;
    static C = "C".charCodeAt(0);
    static PAD_CHAR = 0x1a;

    static crcCalc = new CRC(
        "CRC16_XMODEM",
        16,
        0x1021,
        0x0000,
        0x0000,
        false,
        false
    );

    private serialPort: SerialPort;
    private byteReader = new SerialPort.parsers.ByteLength({ length: 1 });
    logger: YModemLogger = new SimpleLogger();

    constructor(sp: SerialPort) {
        this.serialPort = sp;
        this.serialPort.pipe(this.byteReader);
    }

    /**
     * Sends a file using the YModem protocol.
     * @param fileName The name of the file to send.
     * @param fileData The file itself converted to buffer.
     * @param sendType The type of send to perform. SOH is for 128 byte data packets.
     * STX is for 1024 data byte packets. Defaults to STX.
     */
    async sendFile(
        fileName: string,
        fileData: Buffer,
        delays?: Partial<YModemDelays>
    ) {
        let ymodemDelays = new YModemDelays();
        if (delays) ymodemDelays = ymodemDelays.merge(delays);

        console.log("Starting file send...");

        // [<<< C]
        await this.waitForNext([YModem.C]);

        // [first packet >>>]
        const fileSize = fileData.byteLength;
        const header = YModem.createHeaderPacket(
            YModem.SOH,
            fileName,
            fileSize
        );
        this.serialPort.write(header);
        this.logger.log("[first packet >>>]");

        // [<<< ACK]
        await this.waitForNext([YModem.ACK]);
        // [<<< C]
        await this.waitForNext([YModem.C]);

        let fileChunks: Buffer[];
        let isLastByteSOH = false;

        if (fileData.length <= SendSize[YModem.SOH]) {
            fileChunks = [
                YModem.padRBuffer(
                    fileData,
                    SendSize[YModem.SOH],
                    YModem.PAD_CHAR
                ),
            ];
            isLastByteSOH = true;
        } else if (fileData.length <= SendSize[YModem.STX]) {
            fileChunks = [
                YModem.padRBuffer(
                    fileData,
                    SendSize[YModem.STX],
                    YModem.PAD_CHAR
                ),
            ];
            isLastByteSOH = false;
        } else {
            const fileSplit = YModem.splitFileToChunks(
                fileData,
                SendSize[YModem.STX]
            );
            fileChunks = fileSplit.chunks;
            isLastByteSOH = fileSplit.isLastByteSOH;
        }

        let sendType = YModem.STX;
        for (let packetNo = 1; packetNo <= fileChunks.length; packetNo++) {
            if (YModem.isLast(fileChunks.length, packetNo)) {
                sendType = isLastByteSOH ? YModem.SOH : YModem.STX;
            }

            const fileChunk = fileChunks[packetNo - 1];

            const dataPacket = YModem.createDataPacket(
                sendType,
                packetNo % 256,
                fileChunk
            );

            await this.sendDataPacket(
                packetNo,
                dataPacket,
                ymodemDelays.sendDelay
            );
        }

        // [>>> EOT]
        this.serialPort.write([YModem.EOT]);
        // [<<< NAK]
        await this.waitForNext([YModem.NAK]);
        // [>>> EOT]
        this.serialPort.write([YModem.EOT]);
        // [<<< ACK]
        await this.waitForNext([YModem.ACK]);
        // [<<< C]
        await this.waitForNext([YModem.C]);

        const endPacket = YModem.createTailPacket();
        this.serialPort.write(endPacket);

        // [<<< ACK]
        await this.waitForNext([YModem.ACK]);
    }

    /**
     * Waits for any of the given control characters to appear in the serial buffer.
     * @param controlChars The desired control characters as a number array.
     * @return A promise that is resolved when  any of the given control characters appear in the serial buffer.
     */
    private waitForNext(controlChars: number[]) {
        return new Promise<number>((resolve) => {
            this.onControlCharsRead(controlChars, resolve);
        });
    }

    /**
    * Executes a callback when any of the control characters to appear in the serial buffer.
    * @param controlChars The desired control characters as a number array.
    * @param callback The callback to resolve when the character appears. 
    * Callback should take the received character as an argument of type number.
    */
    private onControlCharsRead(
        controlChars: number[],
        callback: (value: number | PromiseLike<number>) => void
    ) {
        this.byteReader.on("data", 
        function onCharRead(this: YModem, newData: Buffer) {
            const newChar = newData[0];
            if (controlChars.includes(newChar)) {
                this.logger.log(`[<<< ${DebugDict[newChar]}]`);
                this.byteReader.removeListener("data", onCharRead);
                callback(newChar);
            }
        }.bind(this));
    }

    /**
     * Sends a data packet via serial port.
     * @param packetNo The number of the packet to send.
     * @param sendDelay Time (in ms) to wait before trying to send the packet again.
     */
    private async sendDataPacket(
        packetNo: number,
        dataPacket: Buffer,
        sendDelay: number
    ) {
        this.logger.log(`Sending frame: ${packetNo}.`);

        let waitForCCs = this.waitForNext([
            YModem.ACK,
            YModem.NAK,
            YModem.CAN,
        ]);

        for (let retryCount = 1; retryCount <= 10; retryCount++) {
            this.serialPort.write(dataPacket);

            this.logger.log(sendDelay);
            const timeout = sleep(sendDelay);
            const result = await Promise.race([waitForCCs, timeout]);
            this.logger.log("Result", result);

            if (result === YModem.ACK) {
                break;
            }
            if (result === YModem.NAK) {
                retryCount -= 1;
            }
            if (result === YModem.CAN) {
                this.logger.error(`Throw on data frame ${packetNo + 1}.`);
                throw new Error("Operation cancelled by remote device.");
            }
            // Timeout condition won, packet was not acknowledged.
            else {
                this.logger.log(
                    `Packet was not sent! Retrying... Retry No: ${retryCount}.`
                );
            }

            if (retryCount >= 9)
                throw new Error(
                    `Packet timed out after ${retryCount} retries.`
                );
        }
    }

    /**
     * Creates a header packet.
     * @param sendType The type of send to perform.
     * @param fileName The name of the file to send.
     * @param fileSize The number of bytes in the file.
     * @returns A header packet.
     */
    static createHeaderPacket(
        sendType: SendType,
        fileName: string,
        fileSize: number
    ) {
        const chosenSendSize = SendSize[sendType];
        // Since we can only send 0xFF - 1 (header) packages. If the file can't fit in those,
        // then we cannot send it.
        if (0xff - 0x01 * chosenSendSize > fileSize) {
            throw new Error("Couldn't send file. File is too big.");
        }
        // If the filename and file size are bigger than the allowed packet size
        // we cannot send it. We substract 1 since we need a 0x00 separator between them.
        const strFileSize = fileSize.toString();
        if (fileName.length + strFileSize.length > chosenSendSize - 1) {
            throw new Error(
                "Couldn't send file. Either filename is too big or the file is extremely large."
            );
        }

        // Allocate the data packet size plus the header (3) and crc bytes (2)
        const bufferSize = chosenSendSize + 5;
        const headerPacket = Buffer.alloc(bufferSize);

        let currentBufferLoc = 0;

        // Header packet structure
        // [1           1    1                 n                   m             2 ]
        // [sendType, seq, seqOc, fileName..., 0, fileSize..., 0, fileData..., 0, C]
        // where n + m = (128 | 1024)
        headerPacket.writeUInt8(sendType, currentBufferLoc);
        currentBufferLoc += 1;
        // Here we write seq, which is the packet number.
        // Since this is the first packet seq is 0.
        headerPacket.writeUInt8(0x00, currentBufferLoc);
        currentBufferLoc += 1;
        // This is the complement to seq (called seqOc),
        // since seq is 0 seqOc is FF;
        headerPacket.writeUInt8(0xff, currentBufferLoc);
        currentBufferLoc += 1;

        // We write the file name
        headerPacket.write(fileName, currentBufferLoc);
        currentBufferLoc += fileName.length;
        // Separator to indicate this is where the fileName ends
        headerPacket.writeUInt8(0x00, currentBufferLoc);
        currentBufferLoc += 1;
        // We write the fileSize
        headerPacket.write(strFileSize, currentBufferLoc);
        currentBufferLoc += strFileSize.length;
        // Separator to indicate this is where the fileSize ends
        headerPacket.writeUInt8(0x00, currentBufferLoc);
        currentBufferLoc += 1;

        // Calculate the CRC
        const dataFrame = Buffer.from(
            headerPacket.buffer.slice(3, 3 + chosenSendSize)
        );
        const dataCrc = this.calculateCrc(dataFrame);

        // We write the CRC on the last 2 bytes
        headerPacket.writeUInt16BE(dataCrc, bufferSize - 2);

        return headerPacket;
    }

    /**
     * Creates a header packet.
     * @param sendType The type of send to perform.
     * @param seq The packet number.
     * @param fileData The data chunk to send.
     * @returns A data packet.
     */
    private static createDataPacket(
        sendType: SendType,
        seq: number,
        fileData: Buffer
    ) {
        const chosenSendSize = SendSize[sendType];
        const bufferSize = chosenSendSize + 5;
        const dataPacket = Buffer.alloc(bufferSize);

        dataPacket.writeUInt8(sendType, 0);
        dataPacket.writeUInt8(seq, 1);
        const seqOc = 0xff - seq;
        dataPacket.writeUInt8(seqOc, 2);

        fileData.copy(dataPacket, 3);

        const dataCrc = this.calculateCrc(fileData);
        dataPacket.writeUInt16BE(dataCrc, bufferSize - 2);

        return dataPacket;
    }

    /**
     * Creates a tail packet.
     * @returns The EOT packet.
     */
    private static createTailPacket() {
        // SOH 00 ff NUM[128] CRCH CRC
        const buf = Buffer.alloc(128 + 5);
        buf[0] = YModem.SOH;
        buf[1] = 0x00;
        buf[2] = 0xff;

        return buf;
    }

    /**
     * Splits a buffer into chunks,
     * also pads the last chunk with zeroes so it matches a standard chunk size.
     * @param buf The buffer to split.
     * @param chunkSize The size of the chunk in bytes.
     * @returns An array of buffers of the chunk size.
     */
    private static splitFileToChunks(buf: Buffer, chunkSize: number) {
        const chunks = bufferChunks(buf, chunkSize);
        const lastChunk = chunks[chunks.length - 1];

        let isLastByteSOH = false;

        if (lastChunk.buffer.byteLength <= SendSize[YModem.SOH]) {
            chunks[chunks.length - 1] = YModem.padRBuffer(
                lastChunk,
                SendSize[YModem.SOH],
                0x00
            );
            isLastByteSOH = true;
        } else {
            chunks[chunks.length - 1] = YModem.padRBuffer(
                lastChunk,
                SendSize[YModem.STX],
                0x00
            );
        }

        return { chunks: chunks, isLastByteSOH: isLastByteSOH };
    }

    /**
     * Pads a buffer to the right with the specified character.
     * @param buf The buffer to pad
     * @param desiredLength The desired length of the resulting buffer.
     * @param padChar The character to pad the buffer with.
     * @returns The padded buffer.
     */
    private static padRBuffer(
        buf: Buffer,
        desiredLength: number,
        padChar: number = 0x00
    ) {
        const padBuf = Buffer.alloc(desiredLength).fill(padChar);
        buf.copy(padBuf);

        return padBuf;
    }

    /**
     * Returns true if the index is the last element of a given array.
     * @param length The length of the array.
     * @param current The current element.
     * @returns True if the current element is the last, otherwise false.
     */
    private static isLast(length: number, current: number) {
        return length - 1 === current;
    }

    /**
     * Calculates the CRC of the given buffer using the static crcCalc configurations.
     * @param data The data to calculate the CRC of.
     * @returns The CRC as a number.
     */
    private static calculateCrc(data: Buffer) {
        return YModem.crcCalc.compute(data);
    }
}
