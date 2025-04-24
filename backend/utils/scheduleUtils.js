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
        // Use temporary moments based on UTC day to calculate duration correctly
        const tempStart = moment.utc().set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second(), millisecond: 0 });
        const tempEnd = moment.utc().set({ hour: ruleEndTime.hour(), minute: ruleEndTime.minute(), second: ruleEndTime.second(), millisecond: 0 });
        if (tempEnd.isSameOrBefore(tempStart)) {
            tempEnd.add(1, 'day'); // Event duration crosses midnight UTC
        }
        const dailyDuration = moment.duration(tempEnd.diff(tempStart));
        if (dailyDuration.asMilliseconds() <= 0 && !(ruleStartTime.isSame(ruleEndTime))) {
             // console.warn(`BE: Skipping rule ${rule._id} due to zero or negative duration.`);
             return occurrences; // Avoid infinite loops or weird behavior
        }


        // Treat window boundaries as UTC moments
        const windowStartMoment = moment.utc(windowStart);
        const windowEndMoment = moment.utc(windowEnd);

        // Adjust loop start date based on window (all UTC)
        let currentDay = ruleStartDate.clone(); // Start loop from the rule's start date (UTC)
        if (currentDay.isBefore(windowStartMoment.startOf('day'))) { // Compare UTC dates
            // If rule starts before the window, start checking from the window's first day
            currentDay = windowStartMoment.clone().startOf('day');
        }

        // Adjust loop end date based on window and rule end (all UTC)
        // Loop until the day *after* the effective end date to include the end date itself
        const loopEndDate = moment.min(windowEndMoment, ruleEndDate); // Find the latest possible day to check

        // Loop through each day within the relevant range
        while (currentDay.isSameOrBefore(loopEndDate)) {
            let occursOnThisDay = false;

            // Determine if the event rule applies to the current day
            if (rule.repeat) {
                // Format 'dddd' uses English day names, ensure rule.repeatDays matches
                if (rule.repeatType === 'daily') {
                    occursOnThisDay = true;
                } else if (rule.repeatType === 'weekly' && Array.isArray(rule.repeatDays) && rule.repeatDays.includes(currentDay.format('dddd'))) {
                    occursOnThisDay = true;
                }
            } else {
                // For non-repeating events, only occurs on the exact start date of the rule
                if (currentDay.isSame(ruleStartDate, 'day')) { // Compare UTC dates
                    occursOnThisDay = true;
                }
            }

            // If the event occurs on this day, calculate the specific time
            if (occursOnThisDay) {
                // Calculate occurrenceStart based on the current day (UTC) and the rule's start time (UTC)
                const occurrenceStart = currentDay.clone().set({ // currentDay is UTC
                    hour: ruleStartTime.hour(),     // UTC hour from rule
                    minute: ruleStartTime.minute(), // UTC minute from rule
                    second: ruleStartTime.second()  // UTC second from rule
                });
                const occurrenceEnd = occurrenceStart.clone().add(dailyDuration); // Also UTC

                // --- Detailed Logging (Uncomment for deep debugging) ---
                // const debugTimezone = "Asia/Beirut"; // Or user's timezone if available
                // console.log(
                //     `[Debug Rule ${rule._id}] Checking Occurrence ` +
                //     `UTC: ${occurrenceStart.toISOString()} | ` +
                //     `${debugTimezone}: ${occurrenceStart.clone().tz(debugTimezone).format('YYYY-MM-DD HH:mm:ss Z')} ` +
                //     `against Window UTC: [${windowStartMoment.toISOString()}, ${windowEndMoment.toISOString()})`
                // );
                // --- End Logging ---

                // FINAL CHECK: Compare occurrenceStart (UTC) with windowStart/windowEnd (also UTC)
                // and check against exceptions (which are UTC timestamps)
                if (occurrenceStart.isBetween(windowStartMoment, windowEndMoment, undefined, '[)') && // '[)' means >= start AND < end
                    !exceptionTimestamps.has(occurrenceStart.valueOf())) // valueOf is UTC milliseconds
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
        // Return empty array or handle error as appropriate
    }
    return occurrences;
};

module.exports = { generateOccurrencesInRange };

