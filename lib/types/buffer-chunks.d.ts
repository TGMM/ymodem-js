declare module "buffer-chunks" {
    function chunks(buffer: Buffer, chunkSize: number): Buffer[];
    export = chunks;
}