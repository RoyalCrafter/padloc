// import { AsDate } from "./encoding";
import { DeviceInfo } from "./platform";
import { ProvisioningStatus } from "./provisioning";
import { Context } from "./server";
import { Storable, StorageListOptions } from "./storage";

// /**
//  * Unsave (but fast) implementation of uuid v4
//  * Good enough for log events.
//  */
// function uuid() {
//     return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
//         var r = (Math.random() * 16) | 0,
//             v = c == "x" ? r : (r & 0x3) | 0x8;
//         return v.toString(16);
//     });
// }

export class LogEvent extends Storable {
    id: string = "";

    time: Date = new Date();

    context?: {
        sessionId?: string;

        device?: Partial<DeviceInfo>;

        account?: {
            name?: string;
            email?: string;
            id?: string;
        };

        provisioning?: {
            status: ProvisioningStatus;
            metaData?: any;
        };

        location?: {
            city?: string;
            country?: string;
        };
    } = undefined;

    constructor(public type = "", public data?: any, context?: Context) {
        super();
        if (context) {
            this.context = {
                account: context.auth && {
                    email: context.auth.email,
                    id: context.auth.accountId,
                    name: context.account?.name,
                },
                provisioning: context.provisioning?.account && {
                    status: context.provisioning.account.status,
                    metaData: context.provisioning.account.metaData || undefined,
                },
                device: context.device?.toRaw(),
                sessionId: context.session?.id,
                location: context.location,
            };
        }
    }
}

// export interface ListLogEventsOptions {
//     from?: Date;
//     to?: Date;
//     offset?: number;
//     limit?: number;
//     type?: string;
//     account?: string;
//     org?: string;
//     reverse?: boolean;
// }

export interface Logger {
    log(type: string, data?: any): LogEvent;

    list(opts: StorageListOptions<LogEvent>): Promise<LogEvent[]>;

    withContext(context: Context): Logger;
}

export class VoidLogger implements Logger {
    constructor(public context?: Context) {}

    withContext(context: Context) {
        return new VoidLogger(context);
    }

    log(type: string, data?: any) {
        return new LogEvent(type, data);
    }

    async list(_opts: StorageListOptions<LogEvent>) {
        return [];
    }
}

export class MultiLogger implements Logger {
    private _loggers: Logger[] = [];
    public context?: Context;

    constructor(...loggers: Logger[]) {
        this._loggers = loggers;
    }

    withContext(context: Context) {
        return new MultiLogger(...this._loggers.map((logger) => logger.withContext(context)));
    }

    log(type: string, data?: any) {
        const [primary, ...rest] = this._loggers;

        const event = primary.log(type, data);
        rest.forEach((l) => l.log(type, data));

        return event;
    }

    list(opts: StorageListOptions<LogEvent>) {
        return this._loggers[0].list(opts);
    }
}
