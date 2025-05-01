// c:\Users\Anas\Desktop\backend\utils\scheduleUtils.js
const moment = require('moment-timezone'); // Ensure 'moment-timezone' is installed

/**
 * Generates specific event occurrences based on a schedule rule within a given time window.
 * All date comparisons and calculations are performed in UTC.
 *
 * @param {object} rule - The schedule rule object. Should include start, end, repeat, repeatType, repeatDays, exceptionDates, ownerId, _id, title.
 * @param {Date} windowStart - The start of the time window (as JS Date object, representing UTC).
 * @param {Date} windowEnd - The end of the time window (as JS Date object, representing UTC).
 * @returns {Array<object>} An array of occurrence objects { ruleId, ownerId, title, start (Date), end (Date) }.
 */
const generateOccurrencesInRange = (rule, windowStart, windowEnd) => {
    const occurrences = [];
    // --- MODIFIED VALIDATION: Check for ownerId ---
    if (!rule || !rule.start || !rule.end || !rule._id || !rule.ownerId) {
        console.warn("BE: Skipping occurrence generation for invalid/incomplete rule (missing required fields like start, end, _id, ownerId):", rule?._id);
        return occurrences; // Return empty array if essential rule data is missing
    }
    // --- END MODIFICATION ---

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
            console.warn(`BE: Skipping rule ${rule._id} due to invalid UTC date range.`);
            return occurrences;
        }
        if (!ruleStartTime.isValid() || !ruleEndTime.isValid()) {
            console.warn(`BE: Skipping rule ${rule._id} due to invalid UTC start/end time.`);
            return occurrences;
        }

        // Calculate daily duration based on UTC times, handling overnight
        // Use temporary moments based on a fixed date to isolate time calculation
        const tempStart = moment.utc('2000-01-01').set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second(), millisecond: 0 });
        const tempEnd = moment.utc('2000-01-01').set({ hour: ruleEndTime.hour(), minute: ruleEndTime.minute(), second: ruleEndTime.second(), millisecond: 0 });
        if (tempEnd.isSameOrBefore(tempStart)) {
            tempEnd.add(1, 'day'); // Event duration crosses midnight UTC
        }
        const dailyDuration = moment.duration(tempEnd.diff(tempStart));
        // Allow zero duration if start and end times are identical (e.g., reminders)
        if (dailyDuration.asMilliseconds() < 0) {
             console.warn(`BE: Skipping rule ${rule._id} due to negative duration.`);
             return occurrences;
        }


        // Treat window boundaries as UTC moments
        const windowStartMoment = moment.utc(windowStart);
        const windowEndMoment = moment.utc(windowEnd);

        // Adjust loop start date based on window (all UTC)
        // Start checking from the rule's start date or the window's start date, whichever is later.
        let currentDay = moment.max(ruleStartDate, windowStartMoment.clone().startOf('day'));


        // Adjust loop end date based on window and rule end (all UTC)
        // Loop should end at the rule's end date or the window's end date, whichever is earlier.
        const loopEndDate = moment.min(windowEndMoment.clone().subtract(1, 'millisecond'), ruleEndDate); // Use subtract to make windowEnd exclusive


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
                // Add other repeat types (monthly, yearly) here if needed
            } else {
                // For non-repeating events, only check the rule's specific start date
                if (currentDay.isSame(ruleStartDate, 'day')) {
                    occursOnThisDay = true;
                }
            }

            if (occursOnThisDay) {
                // Calculate the specific start time for this day's occurrence in UTC
                const occurrenceStart = currentDay.clone().set({
                    hour: ruleStartTime.hour(),
                    minute: ruleStartTime.minute(),
                    second: ruleStartTime.second(),
                    millisecond: ruleStartTime.millisecond() // Include milliseconds
                });
                // Calculate the end time based on the duration
                const occurrenceEnd = occurrenceStart.clone().add(dailyDuration);

                // FINAL CHECK: Compare occurrenceStart (UTC) with windowStart/windowEnd (also UTC)
                // Use isBetween with inclusivity '[)' -> >= windowStart and < windowEnd
                // Also check against exceptions (which are UTC timestamps)
                if (occurrenceStart.isBetween(windowStartMoment, windowEndMoment, undefined, '[)') &&
                    !exceptionTimestamps.has(occurrenceStart.valueOf()))
                {
                    // --- MODIFIED OCCURRENCE OBJECT: Use ownerId ---
                    occurrences.push({
                        ruleId: rule._id.toString(), // Ensure ruleId is a string if it's an ObjectId
                        ownerId: rule.ownerId, // Use ownerId from the rule object
                        title: rule.title,
                        start: occurrenceStart.toDate(), // Store JS Date object (represents UTC)
                        end: occurrenceEnd.toDate(),     // Store JS Date object (represents UTC)
                    });
                    // --- END MODIFICATION ---
                }
            }
            // Move to the next day (UTC) for the loop
            currentDay.add(1, 'day');
        }
    } catch (error) {
        console.error(`Error generating occurrences for rule ${rule?._id}:`, error);
        // Depending on desired behavior, you might want to re-throw or return empty array
    }
    return occurrences;
};

module.exports = { generateOccurrencesInRange };
