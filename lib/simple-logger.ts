import { YModemLogger } from "./ymodem-logger";

export class SimpleLogger implements YModemLogger {
    log(message?: any, ...optionalParams: any[]): void {
        console.log(message, ...optionalParams);
    }

    error(message?: any, ...optionalParams: any[]): void {
        console.error(message, ...optionalParams);
    }
}