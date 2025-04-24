// c:\Users\Anas\M5\pet-ai-project\backend\utils\scheduleUtils.js
const moment = require('moment-timezone'); // Ensure 'moment-timezone' is installed

/**
 * Generates specific event occurrences based on a schedule rule within a given time window.
 * All date comparisons and calculations are performed in UTC.
 *
 * @param {object} rule - The schedule rule object from MongoDB. Should include start, end, repeat, repeatType, repeatDays, exceptionDates, owner, _id, title.
 * @param {Date} windowStart - The start of the time window (as JS Date object, representing UTC).
 * @param {Date} windowEnd - The end of the time window (as JS Date object, representing UTC).
 * @returns {Array<object>} An array of occurrence objects { ruleId, ownerId, title, start (Date), end (Date) }.
 */
const generateOccurrencesInRange = (rule, windowStart, windowEnd) => {
    const occurrences = [];
    // Basic validation of the rule object
    if (!rule || !rule.start || !rule.end || !rule._id || !rule.owner) {
        // console.warn("BE: Skipping occurrence generation for invalid/incomplete rule:", rule?._id);
        return occurrences; // Return empty array if essential rule data is missing
    }

    try {
        // --- Ensure all moments are treated as UTC ---
        const exceptionTimestamps = new Set(
            (rule.exceptionDates || []).map(date => moment.utc(date).valueOf()) // Treat exceptions as UTC, get timestamp
        );

        // Treat rule start/end dates and times as UTC
        const ruleStartDate = moment.utc(rule.start).startOf('day');
        const ruleEndDate = moment.utc(rule.end).startOf('day');
        const ruleStartTime = moment.utc(rule.start); // Includes time
        const ruleEndTime = moment.utc(rule.end);     // Includes time

        // Validate dates after converting to UTC moments
        if (!ruleStartDate.isValid() || !ruleEndDate.isValid() || ruleEndDate.isBefore(ruleStartDate)) {
            // console.warn(`BE: Skipping rule ${rule._id} due to invalid UTC date range.`);
            return occurrences;
        }
        if (!ruleStartTime.isValid() || !ruleEndTime.isValid()) {
            // console.warn(`BE: Skipping rule ${rule._id} due to invalid UTC start/end time.`);
            return occurrences;
        }

        // Calculate daily duration based on UTC times, handling overnight
        const tempStart = moment.utc().set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second(), millisecond: 0 });
        const tempEnd = moment.utc().set({ hour: ruleEndTime.hour(), minute: ruleEndTime.minute(), second: ruleEndTime.second(), millisecond: 0 });
        if (tempEnd.isSameOrBefore(tempStart)) {
            tempEnd.add(1, 'day'); // Event duration crosses midnight UTC
        }
        const dailyDuration = moment.duration(tempEnd.diff(tempStart));
        if (dailyDuration.asMilliseconds() <= 0 && !(ruleStartTime.isSame(ruleEndTime))) {
             // console.warn(`BE: Skipping rule ${rule._id} due to zero or negative duration.`);
             return occurrences;
        }


        // Treat window boundaries as UTC moments
        const windowStartMoment = moment.utc(windowStart);
        const windowEndMoment = moment.utc(windowEnd);

        // Adjust loop start date based on window (all UTC)
        let currentDay = ruleStartDate.clone();
        if (currentDay.isBefore(windowStartMoment.startOf('day'))) {
            currentDay = windowStartMoment.clone().startOf('day');
        }

        // Adjust loop end date based on window and rule end (all UTC)
        const loopEndDate = moment.min(windowEndMoment, ruleEndDate);

        // Loop through each day within the relevant range
        while (currentDay.isSameOrBefore(loopEndDate)) {
            let occursOnThisDay = false;

            // Determine if the event rule applies to the current day
            if (rule.repeat) {
                if (rule.repeatType === 'daily') {
                    occursOnThisDay = true;
                } else if (rule.repeatType === 'weekly' && Array.isArray(rule.repeatDays) && rule.repeatDays.includes(currentDay.format('dddd'))) {
                    occursOnThisDay = true;
                }
            } else {
                if (currentDay.isSame(ruleStartDate, 'day')) {
                    occursOnThisDay = true;
                }
            }

            if (occursOnThisDay) {
                const occurrenceStart = currentDay.clone().set({
                    hour: ruleStartTime.hour(),
                    minute: ruleStartTime.minute(),
                    second: ruleStartTime.second()
                });
                const occurrenceEnd = occurrenceStart.clone().add(dailyDuration);

                // --- Detailed Logging (Keep commented out unless needed) ---
                // const debugTimezone = "Asia/Beirut";
                // console.log(
                //     `[Debug Rule ${rule._id}] Checking Occurrence ` +
                //     `UTC: ${occurrenceStart.toISOString()} | ` +
                //     `${debugTimezone}: ${occurrenceStart.clone().tz(debugTimezone).format('YYYY-MM-DD HH:mm:ss Z')} ` +
                //     `against Window UTC: [${windowStartMoment.toISOString()}, ${windowEndMoment.toISOString()})`
                // );
                // --- End Logging ---

                // FINAL CHECK: Compare occurrenceStart (UTC) with windowStart/windowEnd (also UTC)
                // and check against exceptions (which are UTC timestamps)
                if (occurrenceStart.isBetween(windowStartMoment, windowEndMoment, undefined, '[)') &&
                    !exceptionTimestamps.has(occurrenceStart.valueOf()))
                {
                    // console.log(`[Debug Rule ${rule._id}]   -> MATCH FOUND within window and not excepted!`);
                    occurrences.push({
                        ruleId: rule._id,
                        ownerId: rule.owner, // Pass the populated owner object
                        title: rule.title,
                        start: occurrenceStart.toDate(), // Store JS Date object (represents UTC)
                        end: occurrenceEnd.toDate(),     // Store JS Date object (represents UTC)
                    });
                }
            }
            currentDay.add(1, 'day'); // Move to the next day (UTC)
        }
    } catch (error) {
        console.error(`Error generating occurrences for rule ${rule?._id}:`, error);
    }
    return occurrences;
};

module.exports = { generateOccurrencesInRange };
