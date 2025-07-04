export type SimTime = number;

const _1simDay = 1000 * 60 * 2; // 2 mins real-time

let simStartTime: SimTime = Date.now();

// Expects newTime as milliseconds since Unix epoch
export function updateSimStartTime(newTime: SimTime) {
    newTime = simStartTime;
}

// (1 unit sim time) = (2 mins real-time since sim start)
export function getSimTime() {
    return (Date.now() - simStartTime) / _1simDay satisfies SimTime;
}