const moment = require('moment-timezone'); // Used for date and time manipulations, including timezones.

/**
 * Generates specific event occurrences based on a schedule rule within a given time window.
 * All date comparisons and calculations are performed in UTC.
 *
 * @param {object} rule - The schedule rule object (contains details like start, end, repeat type, exceptions).
 * @param {Date} windowStart - The start of the time window for generating occurrences (UTC JS Date).
 * @param {Date} windowEnd - The end of the time window for generating occurrences (UTC JS Date).
 * @returns {Array<object>} An array of occurrence objects (each with ruleId, ownerId, title, start, end).
 */
const generateOccurrencesInRange = (rule, windowStart, windowEnd) => {
    const occurrences = [];
    // Initial validation for essential rule properties.
    if (!rule || !rule.start || !rule.end || !rule._id || !rule.ownerId) {
        console.warn("BE: Skipping occurrence generation for invalid/incomplete rule (missing required fields like start, end, _id, ownerId):", rule?._id);
        return occurrences;
    }

    try {
        // Prepare a set of exception timestamps (UTC) for quick lookup.
        const exceptionTimestamps = new Set(
            (rule.exceptionDates || []).map(date => moment.utc(date).valueOf())
        );

        // --- Date and Time Preparation (all in UTC) ---
        // Convert rule's series start/end dates and event start/end times to UTC moments.
        const ruleStartDate = moment.utc(rule.start).startOf('day'); // Date part of rule's overall start.
        const ruleEndDate = moment.utc(rule.end).startOf('day');   // Date part of rule's overall end.
        const ruleStartTime = moment.utc(rule.start); // Specific time of day the event starts.
        const ruleEndTime = moment.utc(rule.end);     // Specific time of day the event ends (used for duration).

        // Validate converted rule dates and times.
        if (!ruleStartDate.isValid() || !ruleEndDate.isValid() || ruleEndDate.isBefore(ruleStartDate)) {
            console.warn(`BE: Skipping rule ${rule._id} due to invalid UTC date range.`);
            return occurrences;
        }
        if (!ruleStartTime.isValid() || !ruleEndTime.isValid()) {
            console.warn(`BE: Skipping rule ${rule._id} due to invalid UTC start/end time.`);
            return occurrences;
        }

        // Calculate the duration of a single event occurrence.
        const tempStart = moment.utc('2000-01-01').set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second(), millisecond: 0 });
        const tempEnd = moment.utc('2000-01-01').set({ hour: ruleEndTime.hour(), minute: ruleEndTime.minute(), second: ruleEndTime.second(), millisecond: 0 });
        if (tempEnd.isSameOrBefore(tempStart)) {
            tempEnd.add(1, 'day'); // Handles events crossing midnight UTC.
        }
        const dailyDuration = moment.duration(tempEnd.diff(tempStart));
        if (dailyDuration.asMilliseconds() < 0) {
             console.warn(`BE: Skipping rule ${rule._id} due to negative duration.`);
             return occurrences;
        }

        // Convert generation window boundaries to UTC moments.
        const windowStartMoment = moment.utc(windowStart);
        const windowEndMoment = moment.utc(windowEnd);

        // Determine effective start and end dates for the iteration loop, considering the rule and window.
        let currentDay = moment.max(ruleStartDate, windowStartMoment.clone().startOf('day'));
        const loopEndDate = moment.min(windowEndMoment.clone().subtract(1, 'millisecond'), ruleEndDate);


        // --- Main Loop: Iterate through each day to find potential occurrences ---
        while (currentDay.isSameOrBefore(loopEndDate)) {
            let occursOnThisDay = false;

            // Determine if the event occurs on 'currentDay' based on its repetition settings.
            if (rule.repeat) {
                if (rule.repeatType === 'daily') {
                    occursOnThisDay = true;
                } else if (rule.repeatType === 'weekly' && Array.isArray(rule.repeatDays) && rule.repeatDays.includes(currentDay.format('dddd'))) {
                    occursOnThisDay = true;
                }
            } else { // For non-repeating events.
                if (currentDay.isSame(ruleStartDate, 'day')) {
                    occursOnThisDay = true;
                }
            }

            if (occursOnThisDay) {
                // Calculate the exact start and end times for this day's occurrence in UTC.
                const occurrenceStart = currentDay.clone().set({
                    hour: ruleStartTime.hour(),
                    minute: ruleStartTime.minute(),
                    second: ruleStartTime.second(),
                    millisecond: ruleStartTime.millisecond()
                });
                const occurrenceEnd = occurrenceStart.clone().add(dailyDuration);

                // Check if the occurrence falls within the generation window and is not an exception.
                if (occurrenceStart.isBetween(windowStartMoment, windowEndMoment, undefined, '[)') &&
                    !exceptionTimestamps.has(occurrenceStart.valueOf()))
                {
                    // Add valid occurrence to the results.
                    occurrences.push({
                        ruleId: rule._id.toString(),
                        ownerId: rule.ownerId,
                        title: rule.title,
                        start: occurrenceStart.toDate(), // Convert to JS Date (UTC).
                        end: occurrenceEnd.toDate(),     // Convert to JS Date (UTC).
                    });
                }
            }
            // Move to the next day for the loop.
            currentDay.add(1, 'day');
        }
    } catch (error) {
        console.error(`Error generating occurrences for rule ${rule?._id}:`, error);
    }
    return occurrences;
};

module.exports = { generateOccurrencesInRange };


