import https from "https";
import { URL } from "url";
import { Observable, throwError } from "rxjs";
import { catchError, timeout } from "rxjs/operators";
import appConfig from "../config/app.config";
import { snakeToCamelCaseMapper } from "./mapper";
// import fs from "fs";
// import { rootCertificates } from 'tls';

export interface HttpClientResponse<T = any> {
  statusCode?: number;
  data: T;
}

export class HttpClient {
  private readonly httpsAgent: https.Agent;

  constructor() {
    this.httpsAgent = new https.Agent({
      // REMOVED: No mTLS for now
      // key: fs.readFileSync(appConfig.keyPath!),
      // cert: fs.readFileSync(appConfig.certPath!),
      // ca: [
      //   ...rootCertificates,
      //   fs.readFileSync(appConfig.caPath!),
      // ],
      rejectUnauthorized: false,
    });
  }

  private request<T = any>(options: {
    url: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers?: Record<string, string>;
    body?: any;
    timeoutMs?: number;
  }): Observable<HttpClientResponse<T>> {
    const {
      url,
      method = "GET",
      headers = {
        'Client-Id': 'Commercial-Bank'
      },
      body,
      timeoutMs = appConfig.timeout,
    } = options;


    const requestBody = body ? JSON.stringify(body) : undefined;

    if (body) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(requestBody!).toString();
    }
    const urlObj = new URL(url);

    const httpsOptions: https.RequestOptions = {
      method,
      headers,
      agent: this.httpsAgent,
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      protocol: urlObj.protocol,
      port: urlObj.port || 443,
    };

    return new Observable<HttpClientResponse<T>>((subscriber) => {
      const req = https.request(httpsOptions, (res) => {
        let rawData = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => (rawData += chunk));
        res.on("end", () => {
          try {
            if (!rawData) {
              subscriber.error(
                this.wrapError(
                  new Error("Empty response body"),
                  "Failed to parse response"
                )
              );
              return;
            }
            const data = this.parseResponse<T>(rawData);
            subscriber.next({
              statusCode: res.statusCode,
              data,
            });
            subscriber.complete();
          } catch (err) {
            subscriber.error(this.wrapError(err, "Failed to parse response"));
          }
        });
      });

      req.on("error", (err) => {
        subscriber.error(this.wrapError(err, "Request failed"));
      });

      if (timeoutMs) {
        req.setTimeout(timeoutMs, () => {
          subscriber.error(
            this.wrapError(
              new Error(`Timeout after ${timeoutMs}ms`),
              "Request timeout"
            )
          );
        });
      }

      if (requestBody) {
        req.write(requestBody);
      }

      req.end();

      return () => {
        if (!req.destroyed) {
          req.destroy();
        }
      };
    }).pipe(
      timeout(timeoutMs),
      catchError((err) =>
        throwError(() => this.wrapError(err, "Request failed"))
      )
    );
  }

  private parseResponse<T>(data: string): T {
    try {
      return snakeToCamelCaseMapper(JSON.parse(data)) as T;
    } catch {
      return data as any as T;
    }
  }

  private wrapError(error: unknown, context: string): Error {
    return error instanceof Error
      ? new Error(`${context}: ${error.message}`)
      : new Error(`${context}: ${String(error)}`);
  }

  public get<T = any>(
    url: string,
    options?: Omit<Parameters<HttpClient["request"]>[0], "url" | "method">
  ): Observable<HttpClientResponse<T>> {
    return this.request<T>({ ...options, url, method: "GET" });
  }

  public post<T = any>(
    url: string,
    body?: any,
    options?: Omit<
      Parameters<HttpClient["request"]>[0],
      "url" | "method" | "body"
    >
  ): Observable<HttpClientResponse<T>> {
    return this.request<T>({ ...options, url, method: "POST", body });
  }

  public put<T = any>(
    url: string,
    body?: any,
    options?: Omit<
      Parameters<HttpClient["request"]>[0],
      "url" | "method" | "body"
    >
  ): Observable<HttpClientResponse<T>> {
    return this.request<T>({ ...options, url, method: "PUT", body });
  }

  public patch<T = any>(
    url: string,
    body?: any,
    options?: Omit<
      Parameters<HttpClient["request"]>[0],
      "url" | "method" | "body"
    >
  ): Observable<HttpClientResponse<T>> {
    return this.request<T>({ ...options, url, method: "PATCH", body });
  }

  public delete<T = any>(
    url: string,
    options?: Omit<Parameters<HttpClient["request"]>[0], "url" | "method">
  ): Observable<HttpClientResponse<T>> {
    return this.request<T>({ ...options, url, method: "DELETE" });
  }
}
