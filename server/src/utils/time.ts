import { HttpClient } from "./http-client";
import { logger } from "./logger";
import appConfig from "../config/app.config";

export type SimTime = number;
const httpClient = new HttpClient();

const REAL_MS_PER_SIM_DAY = 2 * 60 * 1000;
const SIM_MS_PER_DAY = 24 * 60 * 60 * 1000;

let simulationStartTime: number = Date.UTC(2050, 0, 1);
let realStartTime : number = Date.now();
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize the simulation.
 * @param simStartTime - start of simulation in epoch ms
 */
export function initSimulation(simStartTime: number) {
  simulationStartTime = simStartTime;
  realStartTime = Date.now();

  if (syncIntervalId) clearInterval(syncIntervalId);
  syncIntervalId = setInterval(() => {
    syncSimulationTime();
  }, REAL_MS_PER_SIM_DAY);
}

/**
 * Get current simulation time as Unix epoch ms.
 */
export function getSimTime(): SimTime {
  const realElapsedMs = Date.now() - realStartTime;
  const simDaysElapsed = realElapsedMs / REAL_MS_PER_SIM_DAY;
  const simElapsedMs = simDaysElapsed * SIM_MS_PER_DAY;
  return simulationStartTime + simElapsedMs;
}

export function getDateTimeAsISOString(): String{
    const dateTime = new Date(getSimTime());
    return dateTime.toISOString();
}

/**
 * Sync the simulation clock
 */
function syncSimulationTime() {
    httpClient.get(`${appConfig.thohHost}/simulation/current-simulation-time`)
    .subscribe({
        next: (response) => {
            const simCurrentTime = parseInt(response.data.currentSimulationTime + 10); // Offset by 10ms to account for minor network/request latency
            const simElapsedMs = simCurrentTime - getSimTime();
            simulationStartTime += simElapsedMs;
            realStartTime += simElapsedMs;
        },
        error: (error) => {
            logger.error("Error syncing simulation time:", error.message);
        }
    });
}

/**
 * End the simulation.
 */
export function endSimulation() {
  if (syncIntervalId) clearInterval(syncIntervalId);
  syncIntervalId = null;
}