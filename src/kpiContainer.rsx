<Container
  id="kpiContainer"
  footerPadding="4px 12px"
  headerPadding="4px 12px"
  padding="12px"
  showBody={true}
  style={{ border: "surfacePrimaryBorder", borderRadius: "8px" }}
>
  <View id="00030" viewKey="View 1">
    <Icon
      id="calibIcon1"
      horizontalAlign="right"
      icon="bold/interface-validation-check-circle"
      style={{ color: "success", background: "#3170f91a" }}
      styleVariant="background"
    />
    <Icon
      id="calibIcon2"
      horizontalAlign="right"
      icon="bold/interface-alert-warning-triangle"
      style={{ color: "warning", background: "#3170f91a" }}
      styleVariant="background"
    />
    <Icon
      id="calibIcon3"
      horizontalAlign="right"
      icon="bold/interface-alert-warning-circle"
      style={{ color: "danger", background: "#3170f91a" }}
      styleVariant="background"
    />
    <Icon
      id="calibIcon4"
      horizontalAlign="right"
      icon="bold/interface-alert-alarm-bell-1"
      style={{ color: "danger", background: "#3170f91a" }}
      styleVariant="background"
    />
    <Statistic
      id="goodCalibrationStat"
      currency="USD"
      decimalPlaces={0}
      label="Good calibrations (<20 days)"
      labelCaption="Currently in good status"
      positiveTrend="{{ self.value >= 0 }}"
      secondaryCurrency="USD"
      secondaryDecimalPlaces={0}
      secondaryFormattingStyle="percent"
      secondaryPositiveTrend="{{ self.secondaryValue >= 0 }}"
      secondaryShowSeparators={true}
      secondaryValue="{{ filteredCalibData.value.length ? filteredCalibData.value.filter(item => item.calibrationStatus === 'Good').length / filteredCalibData.value.length : 0 }}"
      showSeparators={true}
      suffix=" devices"
      value="{{ filteredCalibData.value.filter(item => item.calibrationStatus === 'Good').length }}"
    />
    <Statistic
      id="warningCalibrationStat"
      currency="USD"
      label="Warnings (21–30 days)"
      labelCaption="Count of assets currently in Warning status (21–30 days)"
      positiveTrend="{{ self.value >= 0 }}"
      secondaryCurrency="USD"
      secondaryDecimalPlaces={0}
      secondaryFormattingStyle="percent"
      secondaryPositiveTrend="{{ self.secondaryValue >= 0 }}"
      secondaryShowSeparators={true}
      secondaryValue="{{ filteredCalibData.value.filter(item => item.calibrationStatus === 'Warning').length / filteredCalibData.value.length }}"
      showSeparators={true}
      suffix=" items"
      value="{{ filteredCalibData.value.filter(item => item.calibrationStatus === 'Warning').length }}"
    />
    <Statistic
      id="criticalCalibrationStat"
      currency="USD"
      decimalPlaces={0}
      label="Critical (31-45)"
      labelCaption="Current count of Critical calibrations"
      positiveTrend="{{ self.value >= 0 }}"
      secondaryCurrency="USD"
      secondaryDecimalPlaces={0}
      secondaryPositiveTrend="{{ self.secondaryValue >= 0 }}"
      secondaryShowSeparators={true}
      secondaryValue=""
      showSeparators={true}
      value="{{ filteredCalibData.value.filter(item => item.calibrationStatus === 'Critical').length }}"
    />
    <Statistic
      id="urgentCalibrationStat"
      currency="USD"
      label="Urgent (46+)"
      labelCaption="Total urgent or overdue items"
      positiveTrend="{{ self.value >= 0 }}"
      secondaryCurrency="USD"
      secondaryPositiveTrend="{{ self.secondaryValue >= 0 }}"
      secondaryShowSeparators={true}
      secondaryValue=""
      showSeparators={true}
      suffix=" items"
      value="{{ filteredCalibData.value.filter(item => item.calibrationStatus === 'Urgent' || item.calibrationStatus === 'Overdue').length }}"
    />
  </View>
</Container>
