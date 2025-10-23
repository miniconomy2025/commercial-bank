import { HttpClient, HttpClientResponse } from "../utils/http-client";
import https from "https";
import http from "http";
import appConfig from "../config/app.config";
import { snakeToCamelCaseMapper } from "../utils/mapper";

jest.mock("https");
jest.mock("http");
jest.mock("../config/app.config");
jest.mock("../utils/mapper");

describe("HttpClient", () => {
  let httpClient: HttpClient;
  let mockRequest: jest.Mock;
  let mockOn: jest.Mock;
  let mockWrite: jest.Mock;
  let mockEnd: jest.Mock;
  let mockSetEncoding: jest.Mock;
  let mockSetTimeout: jest.Mock;
  let mockDestroy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    (appConfig as any).isProd = true;
    (appConfig as any).timeout = 5000;

    (snakeToCamelCaseMapper as jest.Mock).mockImplementation((data) => data);

    mockOn = jest.fn();
    mockWrite = jest.fn();
    mockEnd = jest.fn();
    mockSetTimeout = jest.fn();
    mockDestroy = jest.fn();
    mockSetEncoding = jest.fn();

    const mockReq = {
      on: mockOn,
      write: mockWrite,
      end: mockEnd,
      setTimeout: mockSetTimeout,
      destroy: mockDestroy,
      destroyed: false,
    };

    mockRequest = jest.fn().mockReturnValue(mockReq);
    (https.request as jest.Mock) = mockRequest;
    (http.request as jest.Mock) = mockRequest;
    (https.Agent as unknown as jest.Mock) = jest.fn();

    httpClient = new HttpClient();
  });

  describe("constructor", () => {
    it("should create an https agent with rejectUnauthorized false", () => {
      expect(https.Agent).toHaveBeenCalledWith({
        rejectUnauthorized: false,
      });
    });
  });

  describe("get method", () => {
    it("should make a GET request and return response", (done) => {
      const mockResponse = { data: "test" };
      const mockRes = {
        statusCode: 200,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          if (event === "data") {
            callback(JSON.stringify(mockResponse));
          } else if (event === "end") {
            callback();
          }
        }),
      };

      mockRequest.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient.get("https://api.example.com/test").subscribe({
        next: (response) => {
          expect(response.statusCode).toBe(200);
          expect(response.data).toEqual(mockResponse);
          expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              method: "GET",
              hostname: "api.example.com",
              path: "/test",
            }),
            expect.any(Function)
          );
          done();
        },
        error: (err) => done(err),
      });
    });

    it("should include custom headers", (done) => {
      const mockRes = {
        statusCode: 200,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          if (event === "data") callback('{"data":"test"}');
          else if (event === "end") callback();
        }),
      };

      mockRequest.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient
        .get("https://api.example.com/test", {
          headers: { Authorization: "Bearer token123" },
        })
        .subscribe({
          next: () => {
            expect(mockRequest).toHaveBeenCalledWith(
              expect.objectContaining({
                headers: expect.objectContaining({
                  Authorization: "Bearer token123",
                  "Client-Id": "Commercial-Bank",
                }),
              }),
              expect.any(Function)
            );
            done();
          },
          error: (err) => done(err),
        });
    });

    it("should use http for non-https URLs", (done) => {
      const mockRes = {
        statusCode: 200,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          if (event === "data") callback('{"data":"test"}');
          else if (event === "end") callback();
        }),
      };

      mockRequest.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient.get("http://api.example.com/test").subscribe({
        next: () => {
          expect(http.request).toHaveBeenCalled();
          done();
        },
        error: (err) => done(err),
      });
    });
  });

  describe("post method", () => {
    it("should make a POST request with body", (done) => {
      const requestBody = { name: "test" };
      const mockRes = {
        statusCode: 201,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          if (event === "data") callback('{"id":"123"}');
          else if (event === "end") callback();
        }),
      };

      mockRequest.mockImplementation((options, callback) => {
        // Call callback asynchronously to simulate real HTTP behavior
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient.post("https://api.example.com/items", requestBody).subscribe({
        next: (response) => {
          expect(response.statusCode).toBe(201);
          expect(mockWrite).toHaveBeenCalledWith(JSON.stringify(requestBody));
          expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              method: "POST",
              headers: expect.objectContaining({
                "Content-Type": "application/json",
              }),
            }),
            expect.any(Function)
          );
          done();
        },
        error: (err) => done(err),
      });
    });
  });

  describe("put method", () => {
    it("should make a PUT request with body", (done) => {
      const requestBody = { name: "updated" };
      const mockRes = {
        statusCode: 200,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          if (event === "data") callback('{"success":true}');
          else if (event === "end") callback();
        }),
      };

      mockRequest.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient.put("https://api.example.com/items/1", requestBody).subscribe({
        next: () => {
          expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              method: "PUT",
            }),
            expect.any(Function)
          );
          done();
        },
        error: (err) => done(err),
      });
    });
  });

  describe("patch method", () => {
    it("should make a PATCH request with body", (done) => {
      const requestBody = { status: "active" };
      const mockRes = {
        statusCode: 200,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          if (event === "data") callback('{"success":true}');
          else if (event === "end") callback();
        }),
      };

      mockRequest.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient
        .patch("https://api.example.com/items/1", requestBody)
        .subscribe({
          next: () => {
            expect(mockRequest).toHaveBeenCalledWith(
              expect.objectContaining({
                method: "PATCH",
              }),
              expect.any(Function)
            );
            done();
          },
          error: (err) => done(err),
        });
    });
  });

  describe("delete method", () => {
    it("should make a DELETE request", (done) => {
      const mockRes = {
        statusCode: 204,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          // 204 No Content returns empty body, which is handled by http-client
          if (event === "end") callback();
        }),
      };

      mockRequest.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient.delete("https://api.example.com/items/1").subscribe({
        next: (response) => {
          expect(response.statusCode).toBe(204);
          expect(response.data).toEqual({});
          expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              method: "DELETE",
            }),
            expect.any(Function)
          );
          done();
        },
        error: (err) => done(err),
      });
    });
  });

  describe("error handling", () => {
    it("should handle request errors", (done) => {
      mockRequest.mockImplementation(() => {
        const req = {
          on: jest.fn((event, callback) => {
            if (event === "error") {
              callback(new Error("Network error"));
            }
          }),
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
        return req;
      });

      httpClient.get("https://api.example.com/test").subscribe({
        next: () => done(new Error("Should not succeed")),
        error: (err) => {
          expect(err.message).toContain("Request failed");
          expect(err.message).toContain("Network error");
          done();
        },
      });
    });

    it("should handle timeout errors", (done) => {
      mockRequest.mockImplementation(() => {
        const req = {
          on: jest.fn((event, callback) => {
            if (event === "timeout") {
              callback();
            }
          }),
          write: mockWrite,
          end: mockEnd,
          setTimeout: jest.fn((timeout, callback) => {
            callback();
          }),
          destroy: mockDestroy,
          destroyed: false,
        };
        return req;
      });

      httpClient.get("https://api.example.com/test", { timeoutMs: 1000 }).subscribe({
        next: () => done(new Error("Should not succeed")),
        error: (err) => {
          expect(err.message).toContain("Timeout");
          done();
        },
      });
    });

    it("should handle empty response body", (done) => {
      const mockRes = {
        statusCode: 200,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          if (event === "data") {
            // Don't send any data
          } else if (event === "end") {
            callback();
          }
        }),
      };

      mockRequest.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient.get("https://api.example.com/test").subscribe({
        next: () => done(new Error("Should not succeed")),
        error: (err) => {
          expect(err.message).toContain("Empty response body");
          done();
        },
      });
    });

    it("should handle invalid JSON response gracefully", (done) => {
      const mockRes = {
        statusCode: 200,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          if (event === "data") callback("plain text response");
          else if (event === "end") callback();
        }),
      };

      mockRequest.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient.get("https://api.example.com/test").subscribe({
        next: (response) => {
          // Invalid JSON should be returned as plain text
          expect(response.statusCode).toBe(200);
          expect(response.data).toBe("plain text response");
          done();
        },
        error: (err) => done(err),
      });
    });
  });

  describe("non-production environment", () => {
    it("should return empty observable when isProd is false", (done) => {
      (appConfig as any).isProd = false;
      httpClient = new HttpClient();

      const subscription = httpClient.get("https://api.example.com/test").subscribe({
        next: () => done(new Error("Should not emit")),
        complete: () => {
          expect(mockRequest).not.toHaveBeenCalled();
          done();
        },
        error: (err) => done(err),
      });
    });
  });

  describe("URL parsing", () => {
    it("should handle URLs with query parameters", (done) => {
      const mockRes = {
        statusCode: 200,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          if (event === "data") callback('{"data":"test"}');
          else if (event === "end") callback();
        }),
      };

      mockRequest.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient.get("https://api.example.com/test?foo=bar&baz=qux").subscribe({
        next: () => {
          expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              path: "/test?foo=bar&baz=qux",
            }),
            expect.any(Function)
          );
          done();
        },
        error: (err) => done(err),
      });
    });

    it("should handle custom ports", (done) => {
      const mockRes = {
        statusCode: 200,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          if (event === "data") callback('{"data":"test"}');
          else if (event === "end") callback();
        }),
      };

      mockRequest.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient.get("https://api.example.com:8443/test").subscribe({
        next: () => {
          expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
              port: "8443",
            }),
            expect.any(Function)
          );
          done();
        },
        error: (err) => done(err),
      });
    });
  });

  describe("response parsing", () => {
    it("should use snakeToCamelCaseMapper for valid JSON", (done) => {
      const mockResponse = { snake_case: "value" };
      const mappedResponse = { snakeCase: "value" };

      const mockRes = {
        statusCode: 200,
        setEncoding: mockSetEncoding,
        on: jest.fn((event, callback) => {
          if (event === "data") callback(JSON.stringify(mockResponse));
          else if (event === "end") callback();
        }),
      };

      (snakeToCamelCaseMapper as jest.Mock).mockReturnValue(mappedResponse);

      mockRequest.mockImplementation((options, callback) => {
        setTimeout(() => callback(mockRes), 0);
        return {
          on: mockOn,
          write: mockWrite,
          end: mockEnd,
          setTimeout: mockSetTimeout,
          destroy: mockDestroy,
          destroyed: false,
        };
      });

      httpClient.get("https://api.example.com/test").subscribe({
        next: (response) => {
          expect(snakeToCamelCaseMapper).toHaveBeenCalledWith(mockResponse);
          expect(response.data).toEqual(mappedResponse);
          done();
        },
        error: (err) => done(err),
      });
    });
  });

  describe("cleanup", () => {
    it("should destroy request on unsubscribe", () => {
      const mockReq = {
        on: mockOn,
        write: mockWrite,
        end: mockEnd,
        setTimeout: mockSetTimeout,
        destroy: mockDestroy,
        destroyed: false,
      };

      mockRequest.mockReturnValue(mockReq);

      const subscription = httpClient
        .get("https://api.example.com/test")
        .subscribe();
      subscription.unsubscribe();

      expect(mockDestroy).toHaveBeenCalled();
    });

    it("should not destroy already destroyed request", () => {
      const mockReq = {
        on: mockOn,
        write: mockWrite,
        end: mockEnd,
        setTimeout: mockSetTimeout,
        destroy: mockDestroy,
        destroyed: true,
      };

      mockRequest.mockReturnValue(mockReq);

      const subscription = httpClient
        .get("https://api.example.com/test")
        .subscribe();
      subscription.unsubscribe();

      expect(mockDestroy).not.toHaveBeenCalled();
    });
  });
});