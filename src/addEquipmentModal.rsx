<ModalFrame
  id="addEquipmentModal"
  footerPadding="8px 12px"
  headerPadding="8px 12px"
  hidden={true}
  hideOnEscape={true}
  isHiddenOnMobile={true}
  overlayInteraction={true}
  padding="8px 12px"
  showFooter={true}
  showHeader={true}
  showOverlay={true}
  size="medium"
>
  <Header>
    <Text id="addEquipmentTitle" value="Add Equipment" verticalAlign="center" />
  </Header>
  <Body>
    <Select
      id="equipmentTypeSelect"
      allowDeselect={true}
      data="{{ [ { label: 'Receiver', value: 'Receiver' }, { label: 'GNSS', value: 'GNSS' }, { label: 'Tablet', value: 'Tablet' }, { label: 'Radio', value: 'Radio' }, { label: 'Accessories', value: 'Accessories' } ] }}"
      emptyMessage="No options"
      label="Equipment Type"
      labelPosition="top"
      labels="{{ item.label }}"
      overlayMaxHeight={375}
      placeholder="Select equipment type"
      showClear={true}
      showSelectionIndicator={true}
      values="{{ item.value }}"
    >
      <Option id="00030" value="Option 1" />
      <Option id="00031" value="Option 2" />
      <Option id="00032" value="Option 3" />
    </Select>
    <TextInput
      id="itemNameInput"
      label="Item Name"
      labelPosition="top"
      placeholder="Enter item name"
    />
    <TextInput
      id="assetNumberInput"
      label="Asset Number"
      labelPosition="top"
      placeholder="Enter asset number"
    />
    <TextInput
      id="partNumberInput"
      disabled={true}
      label="Part Number"
      labelPosition="top"
      placeholder="Auto-populated"
    />
    <TextInput
      id="serialNumberInput"
      disabled={true}
      label="Serial Number"
      labelPosition="top"
      placeholder="Auto-populated"
    />
    <TextInput
      id="firmwareInput"
      label="Firmware Version"
      labelPosition="top"
      maxLength={128}
      placeholder="Enter firmware (max 128 characters)"
    />
    <TextInput
      id="assignedNameInput"
      label="Assigned To (Name)"
      labelPosition="top"
      maxLength={64}
      placeholder="Enter name (max 64 characters)"
    />
    <TextInput
      id="employeeNumberInput"
      label="Employee Number"
      labelPosition="top"
      placeholder="Enter 10-digit employee number"
    />
    <Select
      id="calibrationSelect"
      allowDeselect={true}
      data="{{ [{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }] }}"
      emptyMessage="No options"
      label="Calibration Required"
      labelPosition="top"
      labels="{{ item.label }}"
      overlayMaxHeight={375}
      placeholder="Select Yes or No"
      showClear={true}
      showSelectionIndicator={true}
      values="{{ item.value }}"
    >
      <Option id="00030" value="Option 1" />
      <Option id="00031" value="Option 2" />
      <Option id="00032" value="Option 3" />
    </Select>
  </Body>
  <Footer>
    <Button id="cancelAddButton" styleVariant="outline" text="Cancel">
      <Event
        id="f24e5c82"
        event="click"
        method="run"
        params={{ map: { src: "addEquipmentModal.setHidden(true)" } }}
        pluginId=""
        type="script"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
    <Button id="saveEquipmentButton" text="Save">
      <Event
        id="ac4c125f"
        event="click"
        method="run"
        params={{ map: { src: "saveEquipmentScript.trigger()" } }}
        pluginId=""
        type="script"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
  </Footer>
</ModalFrame>
