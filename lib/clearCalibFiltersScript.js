// Reset all calibration dashboard filters
equipmentTypeFilter.clearValue();
calibrationStatusFilter.clearValue();

utils.showNotification({
  title: 'Filters Cleared',
  description: 'All filters have been reset',
  notificationType: 'info',
  duration: 2 });