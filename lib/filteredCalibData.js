// Filter equipment by current user's site and calculate calibration days
const equipment = {{ equipmentData.value }} || [];
const userSite = {{ currentUser.value }}?.siteName || '';
const equipTypeFilter = {{ equipmentTypeFilter.value }} || '';
const calibStatusFilter = {{ calibrationStatusFilter.value }} || '';

// Filter by current user's site
let filtered = equipment.filter((item) => item.site === userSite);

// Apply additional filters
if (equipTypeFilter) {
  filtered = filtered.filter((item) => item.equipmentType === equipTypeFilter);
}

// Calculate days until calibration and assign color codes
const today = moment();
const enriched = filtered.map((item) => {
  let daysUntilCalibration = 0;
  let calibrationStatus = '';
  let colorCode = '';

  if (item.lastCalibratedDate) {
    const lastCalib = moment(item.lastCalibratedDate);
    daysUntilCalibration = today.diff(lastCalib, 'days');

    // Assign color codes based on days
    if (daysUntilCalibration <= 20) {
      calibrationStatus = 'Good';
      colorCode = 'green';
    } else if (daysUntilCalibration <= 30) {
      calibrationStatus = 'Warning';
      colorCode = 'orange';
    } else if (daysUntilCalibration <= 45) {
      calibrationStatus = 'Critical';
      colorCode = 'red';
    } else if (daysUntilCalibration <= 60) {
      calibrationStatus = 'Urgent';
      colorCode = 'yellow';
    } else {
      calibrationStatus = 'Overdue';
      colorCode = 'red-yellow';
    }
  } else {
    calibrationStatus = 'Never Calibrated';
    colorCode = 'gray';
  }

  return {
    ...item,
    daysUntilCalibration,
    calibrationStatus,
    colorCode };

});

// Apply calibration status filter
if (calibStatusFilter) {
  filtered = enriched.filter((item) => item.calibrationStatus === calibStatusFilter);
} else {
  filtered = enriched;
}

return filtered;