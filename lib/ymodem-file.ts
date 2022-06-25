export class YModemFile {
    name: string;
    sizeInBytes: number;
    content: Buffer;

    constructor(name: string, size: number, content: Buffer) {
        this.name = name;
        this.sizeInBytes = size;
        this.content = content;
    }
}