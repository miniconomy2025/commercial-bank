import { Request, Response, NextFunction } from 'express';
import {
  authMiddleware,
  accountMiddleware,
  simulationMiddleware,
  dashboardMiddleware,
} from '../middlewares/auth.middleware';
import { getAccountFromTeamId } from '../queries/auth.queries';
import { logger } from '../utils/logger';
import appConfig from '../config/app.config';
import { Account } from '../types/account.type';

jest.mock('../queries/auth.queries');
jest.mock('../utils/logger');
jest.mock('../config/app.config');

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      headers: {},
      teamId: undefined,
      account: undefined,
      path: '',
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    nextFunction = jest.fn();
  });

  describe('authMiddleware', () => {
    it('should set teamId and call next when client-id header is present', () => {
      mockRequest.headers = { 'client-id': 'test-team-123' };

      authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.teamId).toBe('test-team-123');
      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 401 when client-id header is missing', () => {
      mockRequest.headers = {};

      authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'invalidClientId',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when client-id header is undefined', () => {
      mockRequest.headers = { 'client-id': undefined };

      authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'invalidClientId',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle client-id with special characters', () => {
      mockRequest.headers = { 'client-id': 'team-with-dashes-123' };

      authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.teamId).toBe('team-with-dashes-123');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle empty string client-id as invalid', () => {
      mockRequest.headers = { 'client-id': '' };

      authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'invalidClientId',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('accountMiddleware', () => {
    const mockAccount: Account = {
      id: 1,
      account_number: '123456789012',
      team_id: 'test-team',
      notification_url: 'https://example.com/notify',
      created_at: Date.now(),
    };

    beforeEach(() => {
      mockRequest.teamId = 'test-team';
    });

    it('should fetch account and call next when account exists', async () => {
      (getAccountFromTeamId as jest.Mock).mockResolvedValue(mockAccount);

      await accountMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(getAccountFromTeamId).toHaveBeenCalledWith('test-team');
      expect(mockRequest.account).toEqual(mockAccount);
      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 404 when account does not exist', async () => {
      (getAccountFromTeamId as jest.Mock).mockResolvedValue(null);

      await accountMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(getAccountFromTeamId).toHaveBeenCalledWith('test-team');
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'accountNotFound',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 500 when database query fails', async () => {
      const dbError = new Error('Database connection failed');
      (getAccountFromTeamId as jest.Mock).mockRejectedValue(dbError);

      await accountMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching account:',
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'internalError',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle undefined teamId', async () => {
      mockRequest.teamId = undefined;
      (getAccountFromTeamId as jest.Mock).mockResolvedValue(null);

      await accountMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(getAccountFromTeamId).toHaveBeenCalledWith(undefined);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should not modify request.account when account is not found', async () => {
      mockRequest.account = undefined;
      (getAccountFromTeamId as jest.Mock).mockResolvedValue(null);

      await accountMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.account).toBeUndefined();
    });
  });

  describe('simulationMiddleware', () => {
    beforeEach(() => {
      (appConfig as any).thohTeamId = 'thoh';
    });

    it('should call next when teamId matches thohTeamId', () => {
      mockRequest.teamId = 'thoh';
      Object.defineProperty(mockRequest, 'path', { value: '/some-path' });

      simulationMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 403 when teamId does not match thohTeamId', () => {
      mockRequest.teamId = 'other-team';
      Object.defineProperty(mockRequest, 'path', { value: '/some-path' });

      simulationMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'forbiddenThohOnly',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow charge-interest endpoint regardless of teamId', () => {
      mockRequest.teamId = 'any-team';
      Object.defineProperty(mockRequest, 'path', { value: '/charge-interest' });

      simulationMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow process-installments endpoint regardless of teamId', () => {
      mockRequest.teamId = 'any-team';
      Object.defineProperty(mockRequest, 'path', { value: '/process-installments' });

      simulationMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should block non-thoh team for other endpoints', () => {
      mockRequest.teamId = 'regular-team';
      Object.defineProperty(mockRequest, 'path', { value: '/other-endpoint' });

      simulationMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'forbiddenThohOnly',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle undefined teamId', () => {
      mockRequest.teamId = undefined;
      Object.defineProperty(mockRequest, 'path', { value: '/some-path' });

      simulationMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'forbiddenThohOnly',
      });
    });

    it('should be case-sensitive for teamId comparison', () => {
      mockRequest.teamId = 'THOH';
      Object.defineProperty(mockRequest, 'path', { value: '/some-path' });

      simulationMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('dashboardMiddleware', () => {
    it('should always call next', () => {
      dashboardMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should call next regardless of request properties', () => {
      mockRequest.teamId = 'some-team';
      mockRequest.headers = { 'client-id': 'test' };

      dashboardMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should not modify request or response', () => {
      const originalRequest = { ...mockRequest };

      dashboardMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest).toEqual(originalRequest);
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Middleware integration scenarios', () => {
    it('should work in sequence: auth -> account', async () => {
      const mockAccount: Account = {
        id: 1,
        account_number: '123456789012',
        team_id: 'test-team',
        notification_url: 'https://example.com/notify',
        created_at: Date.now(),
      };

      mockRequest.headers = { 'client-id': 'test-team' };
      (getAccountFromTeamId as jest.Mock).mockResolvedValue(mockAccount);

      // First middleware - auth
      authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.teamId).toBe('test-team');
      expect(nextFunction).toHaveBeenCalledTimes(1);

      // Second middleware - account
      await accountMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.account).toEqual(mockAccount);
      expect(nextFunction).toHaveBeenCalledTimes(2);
    });

    it('should work in sequence: auth -> simulation (thoh)', () => {
      (appConfig as any).thohTeamId = 'thoh';
      mockRequest.headers = { 'client-id': 'thoh' };
      Object.defineProperty(mockRequest, 'path', { value: '/some-simulation' });

      authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.teamId).toBe('thoh');
      expect(nextFunction).toHaveBeenCalledTimes(1);

      simulationMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledTimes(2);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should block at simulation when non-thoh team tries to access', () => {
      (appConfig as any).thohTeamId = 'thoh';
      mockRequest.headers = { 'client-id': 'regular-team' };
      Object.defineProperty(mockRequest, 'path', { value: '/simulation-endpoint' });

      authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockRequest.teamId).toBe('regular-team');
      expect(nextFunction).toHaveBeenCalledTimes(1);

      simulationMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(nextFunction).toHaveBeenCalledTimes(1);
    });
  });
});

