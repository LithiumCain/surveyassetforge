<Container
  id="kpiMetricsContainer"
  footerPadding="4px 12px"
  headerPadding="4px 12px"
  padding="12px"
  showBody={true}
  style={{ border: "surfacePrimaryBorder", borderRadius: "8px" }}
>
  <View id="00030" viewKey="View 1">
    <Icon
      id="equipIcon1"
      horizontalAlign="right"
      icon="bold/shipping-box-1"
      style={{ color: "primary", background: "#3170f91a" }}
      styleVariant="background"
    />
    <Icon
      id="equipIcon2"
      horizontalAlign="right"
      icon="bold/money-currency-dollar"
      style={{ color: "secondary", background: "#3170f91a" }}
      styleVariant="background"
    />
    <Icon
      id="equipIcon3"
      horizontalAlign="right"
      icon="bold/money-graph-bar-increase"
      style={{ color: "highlight", background: "#3170f91a" }}
      styleVariant="background"
    />
    <Statistic
      id="totalEquipmentStatistic"
      currency="USD"
      decimalPlaces={0}
      label="Total Equipment"
      labelCaption="Items matching current filters"
      positiveTrend="{{ self.value >= 0 }}"
      secondaryCurrency="USD"
      secondaryDecimalPlaces={0}
      secondaryPositiveTrend="{{ self.secondaryValue >= 0 }}"
      secondaryShowSeparators={true}
      secondaryValue=""
      showSeparators={true}
      suffix=" items"
      value="{{ filteredAdminData.value.length }}"
    />
    <Statistic
      id="totalCostStatistic"
      currency="USD"
      decimalPlaces={2}
      formattingStyle="currency"
      label="Total Cost"
      labelCaption="Across filtered records"
      padDecimal={true}
      positiveTrend="{{ self.value >= 0 }}"
      secondaryCurrency="USD"
      secondaryDecimalPlaces={0}
      secondaryPositiveTrend="{{ self.secondaryValue >= 0 }}"
      secondaryShowSeparators={true}
      secondaryValue=""
      showSeparators={true}
      value="{{ filteredAdminData.value.reduce((sum, item) => sum + item.cost, 0) }}"
    />
    <Statistic
      id="currentValueStatistic"
      currency="USD"
      decimalPlaces={2}
      label="Total current value"
      labelCaption="Across filtered records"
      positiveTrend="{{ self.value >= 0 }}"
      secondaryCurrency="USD"
      secondaryDecimalPlaces={2}
      secondaryPositiveTrend="{{ self.secondaryValue >= 0 }}"
      secondaryShowSeparators={true}
      secondaryValue=""
      showSeparators={true}
      value="{{ filteredAdminData.value.reduce((sum, item) => sum + item.currentValue, 0) }}"
    />
  </View>
</Container>
