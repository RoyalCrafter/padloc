import { createServer, IncomingMessage } from "http";
import { Receiver, Request, Sender, Response } from "@padloc/core/src/transport";
import { marshal, unmarshal } from "@padloc/core/src/encoding";
import { Err, ErrorCode } from "@padloc/core/src/error";
import { getLocation } from "../geoip";
import { request as requestHttps } from "https";
import { request as requestHttp } from "http";

export function readBody(request: IncomingMessage, maxSize = 1e7): Promise<string> {
    return new Promise((resolve, reject) => {
        const body: Buffer[] = [];
        let size = 0;

        request
            .on("data", (chunk) => {
                size += chunk.length;
                if (size > maxSize) {
                    console.error("Max request size exceeded!", size, maxSize);
                    request.destroy(new Err(ErrorCode.MAX_REQUEST_SIZE_EXCEEDED));
                }
                body.push(chunk);
            })
            .on("error", (e) => {
                reject(e);
            })
            .on("end", () => {
                resolve(Buffer.concat(body).toString());
            });
    });
}

export class HTTPReceiver implements Receiver {
    constructor(public port: number, public maxRequestSize = 1e9) {}

    async listen(handler: (req: Request) => Promise<Response>) {
        const server = createServer(async (httpReq, httpRes) => {
            httpRes.on("error", (e) => {
                // todo
                console.error(e);
            });

            httpRes.setHeader("Access-Control-Allow-Origin", "*");
            httpRes.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
            httpRes.setHeader("Access-Control-Allow-Headers", "Content-Type");

            switch (httpReq.method) {
                case "OPTIONS":
                    httpRes.end();
                    break;
                case "POST":
                    const body = await readBody(httpReq, this.maxRequestSize);
                    const req = new Request().fromRaw(unmarshal(body));
                    const ipAddress = httpReq.headers["x-forwarded-for"] || httpReq.socket?.remoteAddress;
                    req.ipAddress = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;
                    const location = req.ipAddress && (await getLocation(req.ipAddress));
                    req.location = location
                        ? {
                              country: location.country?.names["en"],
                              city: location.city?.names["en"],
                          }
                        : undefined;

                    const clientVersion = (req.device && req.device.appVersion) || undefined;
                    const res = await handler(req);
                    const resBody = marshal(res.toRaw(clientVersion));
                    httpRes.setHeader("Content-Type", "application/json; charset=utf-8");
                    httpRes.setHeader("Content-Length", Buffer.byteLength(resBody));
                    httpRes.write(resBody);
                    httpRes.end();
                    break;
                default:
                    httpRes.statusCode = 405;
                    httpRes.end();
            }
        });

        server.listen(this.port);
    }
}

export class HTTPSender implements Sender {
    constructor(public url: string) {}

    async send(req: Request): Promise<Response> {
        const body = marshal(req.toRaw());

        const start = Date.now();

        return new Promise((resolve, reject) => {
            const url = new URL(this.url);
            const fn = url.protocol === "https:" ? requestHttps : requestHttp;
            const req = fn(
                url,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                },
                (res) => {
                    res.setEncoding("utf8");
                    let body = "";

                    res.on("data", (data) => {
                        body += data;
                    });

                    res.on("end", () => {
                        try {
                            resolve(new Response().fromRaw(unmarshal(body)));
                        } catch (e) {
                            reject(new Err(ErrorCode.SERVER_ERROR, e.message, { error: e }));
                        }
                    });

                    res.on("error", (e) => reject(e));
                }
            );

            req.write(body);
            req.end();
        }).then((res: Response) => {
            console.log("request finished: ", req.method, Date.now() - start);
            return res;
        });
    }
}
