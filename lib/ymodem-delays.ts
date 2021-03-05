export class YModemDelays {
    sendDelay = 50;
    resendDelay = 5;
    readCharDelay = 150;

    clone() {
        const yModemDelays = new YModemDelays();
        yModemDelays.sendDelay = this.sendDelay;
        yModemDelays.resendDelay = this.resendDelay;
        yModemDelays.readCharDelay = this.readCharDelay;

        return yModemDelays;
    }

    merge(another: Partial<YModemDelays>) {
        return Object.assign(this.clone(), another);
    }
}
