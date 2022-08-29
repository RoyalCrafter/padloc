import { Logger, LogEvent } from "@padloc/core/src/logging";
import { Context } from "@padloc/core/src/server";
import { StorageListOptions } from "@padloc/core/src/storage";
import { ObjectId } from "mongodb";
import { MongoDBStorage } from "../storage/mongodb";

export class MongoDBLogger implements Logger {
    constructor(private _storage: MongoDBStorage, public context?: Context) {}

    withContext(context: Context) {
        return new MongoDBLogger(this._storage, context);
    }

    log(type: string, data?: any) {
        const event = new LogEvent(type, data);
        event.id = new ObjectId().toString();
        (async () => {
            try {
                this._storage.save(event, { useObjectId: true, acknowledge: false });
            } catch (e) {}
        })();
        return event;
    }

    list(opts: StorageListOptions<LogEvent>) {
        return this._storage.list(LogEvent, opts);
    }
}
