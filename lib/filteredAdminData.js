// Filter equipment data and calculate depreciation/current value
const equipment = {{ equipmentData.value }} || [];
const siteFilter = {{ siteSearchInput.value }}?.toLowerCase() || '';
const vendorFilter = {{ vendorFilterSelect.value }} || '';

// Filter by site and vendor
let filtered = equipment.filter((item) => {
  const matchesSite = !siteFilter || item.site?.toLowerCase().includes(siteFilter);
  const matchesVendor = !vendorFilter || item.vendor === vendorFilter;
  return matchesSite && matchesVendor;
});

// Calculate current value using depreciation formula: cost - (cost/1095 * days since acquired)
const today = moment();
const enriched = filtered.map((item) => {
  const acquiredDate = moment(item.acquiredDate);
  const daysSinceAcquired = today.diff(acquiredDate, 'days');
  const depreciationPerDay = item.cost / 1095; // 3 years = 1095 days
  const depreciation = depreciationPerDay * daysSinceAcquired;
  const currentValue = Math.max(0, item.cost - depreciation);

  return {
    ...item,
    currentValue: currentValue,
    endOfLife: acquiredDate.add(36, 'months').format('YYYY-MM-DD') };

});

return enriched;