// c:\Users\Anas\M5\pet-ai-project\backend\utils\scheduleUtils.js
const moment = require('moment'); // Make sure moment is installed on backend

// Backend version of generateOccurrences
// Takes a single rule and a time window (start/end Date objects)
const generateOccurrencesInRange = (rule, windowStart, windowEnd) => {
    const occurrences = [];
    if (!rule || !rule.start || !rule.end || !rule._id || !rule.owner) {
        // console.warn("BE: Skipping occurrence generation for invalid/incomplete rule:", rule?._id);
        return occurrences;
    }

    const exceptionTimestamps = new Set(
        (rule.exceptionDates || []).map(date => moment(date).valueOf())
    );

    const ruleStartDate = moment(rule.start).startOf('day');
    const ruleEndDate = moment(rule.end).startOf('day');
    const ruleStartTime = moment(rule.start);
    const ruleEndTime = moment(rule.end);

    if (!ruleStartDate.isValid() || !ruleEndDate.isValid() || ruleEndDate.isBefore(ruleStartDate)) return occurrences;
    if (!ruleStartTime.isValid() || !ruleEndTime.isValid()) return occurrences;

    const tempStart = moment().set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second(), millisecond: 0 });
    const tempEnd = moment().set({ hour: ruleEndTime.hour(), minute: ruleEndTime.minute(), second: ruleEndTime.second(), millisecond: 0 });
    if (tempEnd.isSameOrBefore(tempStart)) { tempEnd.add(1, 'day'); }
    const dailyDuration = moment.duration(tempEnd.diff(tempStart));

    // Adjust loop start based on window
    let current = ruleStartDate.clone();
    const windowStartMoment = moment(windowStart).startOf('day'); // Ensure windowStart is a moment
    if (current.isBefore(windowStartMoment)) {
        current = windowStartMoment;
    }

    // Adjust loop end based on window and rule end
    const loopEndDate = moment.min(moment(windowEnd), ruleEndDate); // Ensure windowEnd is a moment

    while (current.isSameOrBefore(loopEndDate)) {
        let occursOnThisDay = false;
        if (rule.repeat) {
            if (rule.repeatType === 'daily') occursOnThisDay = true;
            else if (rule.repeatType === 'weekly' && rule.repeatDays?.includes(current.format('dddd'))) occursOnThisDay = true;
        } else {
            if (current.isSame(ruleStartDate, 'day')) occursOnThisDay = true;
        }

        if (occursOnThisDay) {
            const occurrenceStart = current.clone().set({ hour: ruleStartTime.hour(), minute: ruleStartTime.minute(), second: ruleStartTime.second() });
            const occurrenceEnd = occurrenceStart.clone().add(dailyDuration);

            // --- ADD LOGGING ---
            // console.log(`[Debug Rule ${rule._id}] Checking Occurrence: ${occurrenceStart.toISOString()} (${occurrenceStart.format()}) against Window: ${moment(windowStart).toISOString()} - ${moment(windowEnd).toISOString()}`);
            // --- END LOGGING ---


            // Check if this occurrence START time falls within the query window AND is not an exception
            if (occurrenceStart.isBetween(windowStart, windowEnd, undefined, '[)') && // Use [) - inclusive start, exclusive end
                !exceptionTimestamps.has(occurrenceStart.valueOf()))
            {
                // console.log(`[Debug Rule ${rule._id}]   -> MATCH FOUND!`); // Log if it matches
                occurrences.push({
                    // Include necessary info for the reminder
                    ruleId: rule._id,
                    ownerId: rule.owner, // Make sure owner is populated or available
                    title: rule.title,
                    start: occurrenceStart.toDate(), // Store as Date object
                    end: occurrenceEnd.toDate(),
                });
            }
        }
        current.add(1, 'day');
    }
    return occurrences;
};

module.exports = { generateOccurrencesInRange };
