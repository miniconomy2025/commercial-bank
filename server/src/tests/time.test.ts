import { 
  getDateTimeAsISOString, 
  initSimulation,
  endSimulation,
  REAL_MS_PER_SIM_DAY, 
  SIM_MS_PER_DAY 
} from '../utils/time';
import * as simTime from '../utils/time';

describe('Time utilities', () => {
  let dateNowSpy: jest.SpyInstance<number, []>;
  let currentTime = 0;

  beforeEach(() => {
    jest.useFakeTimers();
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => jest.now());
    const simTimeSpy = jest.spyOn(simTime, 'getSimTime').mockImplementation(() => jest.now());
  });

  afterEach(() => {
    dateNowSpy?.mockRestore();
    jest.useRealTimers();
    endSimulation();
  });

  describe('initSimulation', () => {
    it('calls the callback every simulation day', () => {

      const callback = jest.fn();
      const simStartTime = 1761129253239;

      initSimulation(simStartTime, callback);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(REAL_MS_PER_SIM_DAY);
      expect(callback).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(REAL_MS_PER_SIM_DAY);
      expect(callback).toHaveBeenCalledTimes(2);

    });

    it('should clear previous interval when called multiple times', () => {

      const simStartTime = 1761129253239;
      const callback = jest.fn();
      
      initSimulation(simStartTime, callback);
      initSimulation(simStartTime, callback);
      
      jest.advanceTimersByTime(REAL_MS_PER_SIM_DAY);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSimTime', () => {
    it('should calculate correct simulation time based on real elapsed time', () => {

      
      const simStartTime = 1761129253239;
      initSimulation(simStartTime);
      
      jest.advanceTimersByTime(REAL_MS_PER_SIM_DAY);
      const expectedSimTime = simStartTime + REAL_MS_PER_SIM_DAY;
      const getSimTime  = simTime.getSimTime();
      expect(getSimTime).toBe(expectedSimTime);
    });

    it('should handle multiple days of simulation time', () => {
      
      const simStartTime = 1761129253239;
      initSimulation(simStartTime);
      
      currentTime += REAL_MS_PER_SIM_DAY * 3;
      
      const expectedSimTime = simStartTime + (SIM_MS_PER_DAY * 3);

      expect(simTime.getSimTime()).toBe(expectedSimTime);
    });
  });

  describe('getDateTimeAsISOString', () => {
    it('should return correct ISO string for simulation time', () => {
      
      const simStartTime = 1761129253239;
      
      initSimulation(simStartTime);
      expect(getDateTimeAsISOString()).toBe('2025-10-22T10:34:13.239Z');
      
      jest.advanceTimersByTime(REAL_MS_PER_SIM_DAY);
      expect(getDateTimeAsISOString()).toBe('2025-10-22T10:36:13.239Z');
    });
  });

  describe('endSimulation', () => {
    it('should clear the sync interval', () => {

      const simStartTime = 1761129253239;
      const callback = jest.fn();
      
      initSimulation(simStartTime, callback);
      endSimulation();
      
      jest.advanceTimersByTime(REAL_MS_PER_SIM_DAY);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple calls safely', () => {

      const simStartTime = 1761129253239;
      
      initSimulation(simStartTime);
      endSimulation();
      endSimulation();
      
      expect(() => simTime.getSimTime()).not.toThrow();
    });
  });

});
