// Add new equipment to equipmentData
const currentData = equipmentData.value || [];
const newId = Math.max(0, ...currentData.map((item) => item.id)) + 1;

const newEquipment = {
  id: newId,
  site: currentUser.value?.siteName || 'Unknown Site',
  equipmentType: equipmentTypeSelect.value,
  itemName: itemNameInput.value,
  assetNumber: assetNumberInput.value,
  partNumber: partNumberInput.value,
  serialNumber: serialNumberInput.value,
  firmware: firmwareInput.value,
  assignedName: assignedNameInput.value,
  employeeNumber: employeeNumberInput.value,
  calibration: calibrationSelect.value,
  acquiredDate: moment().format('YYYY-MM-DD'),
  vendor: 'TBD', // Can be set later via edit
  cost: 0, // Can be set later via edit
  replacementCost: 0, // Can be set later via edit
  lastCalibratedDate: calibrationSelect.value === 'Yes' ? moment().format('YYYY-MM-DD') : null };


equipmentData.setValue([...currentData, newEquipment]);

// Close the modal
addEquipmentModal.setHidden(true);

// Show success message
utils.showNotification({
  title: 'Success',
  description: 'Equipment added successfully',
  notificationType: 'success',
  duration: 3 });