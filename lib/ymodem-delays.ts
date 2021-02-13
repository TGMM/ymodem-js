export class YModemDelays {
    sendDelay: number = 50;
    resendDelay: number = 5;
    readCharDelay: number = 150;

    clone() {
        let yModemDelays = new YModemDelays();
        yModemDelays.sendDelay = this.sendDelay;
        yModemDelays.resendDelay = this.resendDelay;
        yModemDelays.readCharDelay = this.readCharDelay;

        return yModemDelays;
    }

    merge(another: Partial<YModemDelays>) {
        return Object.assign(this.clone(), another);
    }
}
