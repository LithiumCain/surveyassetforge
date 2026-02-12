// Reset all admin dashboard filters
siteSearchInput.clearValue();
vendorFilterSelect.clearValue();

utils.showNotification({
  title: 'Filters Cleared',
  description: 'All filters have been reset',
  notificationType: 'info',
  duration: 2 });