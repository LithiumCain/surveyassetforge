// Update existing equipment in equipmentData
const currentData = equipmentData.value || [];
const selectedRow = equipmentTable.selectedSourceRow;

if (!selectedRow) {
  utils.showNotification({
    title: 'Error',
    description: 'No equipment selected',
    notificationType: 'error',
    duration: 3 });

  return;
}

// Check if calibration was changed from No to Yes
const previousCalibration = selectedRow.calibration;
const newCalibration = editCalibrationSelect.value;
const shouldResetCalibration = previousCalibration === 'No' && newCalibration === 'Yes';

const updatedData = currentData.map((item) => {
  if (item.id === selectedRow.id) {
    return {
      ...item,
      equipmentType: editEquipmentTypeSelect.value,
      itemName: editItemNameInput.value,
      assetNumber: editAssetNumberInput.value,
      partNumber: editPartNumberInput.value,
      serialNumber: editSerialNumberInput.value,
      firmware: editFirmwareInput.value,
      assignedName: editAssignedNameInput.value,
      employeeNumber: editEmployeeNumberInput.value,
      calibration: newCalibration,
      lastCalibratedDate: shouldResetCalibration ? moment().format('YYYY-MM-DD') : item.lastCalibratedDate };

  }
  return item;
});

equipmentData.setValue(updatedData);

// Close the modal
editEquipmentModal.setHidden(true);

// Show success message
utils.showNotification({
  title: 'Success',
  description: shouldResetCalibration ? 'Equipment updated and calibration reset' : 'Equipment updated successfully',
  notificationType: 'success',
  duration: 3 });