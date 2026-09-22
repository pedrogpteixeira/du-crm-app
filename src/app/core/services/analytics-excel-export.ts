import { Injectable } from '@angular/core';

import {
  AnalyticsDirectDebitAnalytics,
  AnalyticsDistributionItem,
  AnalyticsPeriod,
  AnalyticsPeriodValues,
  AnalyticsProductsAnalytics,
  AnalyticsProviderId,
  AnalyticsRegistrationNamesAnalytics,
  AnalyticsSegmentsAnalytics,
  AnalyticsStatesAnalytics,
  AnalyticsSvaAnalytics,
} from '../models/analytics.model';

interface AnalyticsExcelExportPayload {
  providerId: AnalyticsProviderId;
  providerLabel: string;
  period: AnalyticsPeriod;
  periodLabel: string;
  totalContracts: number;
  states: AnalyticsStatesAnalytics;
  registrationNames: AnalyticsRegistrationNamesAnalytics;
  products: AnalyticsProductsAnalytics;
  segments: AnalyticsSegmentsAnalytics;
  directDebit: AnalyticsDirectDebitAnalytics;
  sva: AnalyticsSvaAnalytics;
}

type ExcelCellValue = string | number | boolean | null;

interface ExcelChartSeries {
  name: string;
  values: number[];
  color: string;
}

interface ExcelChartDefinition {
  title: string;
  categories: string[];
  series: ExcelChartSeries[];
  percentage?: boolean;
}

interface ExcelSheetDefinition {
  name: string;
  rows: ExcelCellValue[][];
  headerRows?: readonly number[];
  titleRows?: readonly number[];
  freezeHeader?: boolean;
  charts?: readonly ExcelChartDefinition[];
}

interface ExcelDrawingContext {
  sheetIndex: number;
  drawingIndex: number;
  chartStartIndex: number;
  charts: readonly ExcelChartDefinition[];
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsExcelExportService {
  exportAnalytics(payload: AnalyticsExcelExportPayload): void {
    const sheets = this.buildSheets(payload);
    const workbookBytes = this.buildXlsx(sheets);
    const filename = this.buildFilename(
      payload.providerId,
      payload.period,
    );

    this.downloadFile(workbookBytes, filename);
  }

  private buildSheets(payload: AnalyticsExcelExportPayload): ExcelSheetDefinition[] {
    const period = payload.period;
    const directDebitTotal = this.periodValue(
      payload.directDebit.totalWithDirectDebitByPeriod,
      period,
      payload.directDebit.totalWithDirectDebit,
    );
    const directDebitPercentage = this.periodValue(
      payload.directDebit.percentageWithDirectDebitByPeriod,
      period,
      payload.directDebit.percentageWithDirectDebit,
    );
    const svaTotal = this.periodValue(
      payload.sva.totalWithSvaByPeriod,
      period,
      payload.sva.totalWithSva,
    );
    const svaPercentage = this.periodValue(
      payload.sva.percentageWithSvaByPeriod,
      period,
      payload.sva.percentageWithSva,
    );

    const summarySheet: ExcelSheetDefinition = {
      name: 'Resumo',
      titleRows: [1],
      headerRows: [8],
      rows: [
        ['Dashboard Analytics'],
        [],
        ['Comercializadora', payload.providerLabel],
        ['Período', payload.periodLabel],
        ['Total de contratos', payload.totalContracts],
        ['Gerado em', new Intl.DateTimeFormat('pt-PT', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date())],
        [],
        ['Indicador', 'Quantidade', 'Percentagem (%)'],
        ['Total de contratos', payload.totalContracts, null],
        ['Contratos com Débito Direto', directDebitTotal, directDebitPercentage],
        ['Contratos com SVA', svaTotal, svaPercentage],
      ],
    };

    const statesSheet = this.distributionSheet(
      'Estados',
      'Estado',
      payload.states.items,
      period,
    );
    const registrationNamesSheet = this.distributionSheet(
      'Registo C.U.',
      'Nome Registo C.U.',
      payload.registrationNames.items,
      period,
    );
    const productsSheet = this.distributionSheet(
      'Produtos',
      'Produto',
      payload.products.items,
      period,
    );
    const segmentsSheet = this.distributionSheet(
      'Segmentos',
      'Segmento',
      payload.segments.items,
      period,
    );
    const directDebitSheet: ExcelSheetDefinition = {
      name: 'Débito Direto',
      headerRows: [1],
      freezeHeader: true,
      rows: [
        [
          'Nome Registo C.U.',
          'Contratos com DD',
          'Total contratos da equipa',
          '% do total CRM',
          '% DD dentro da equipa',
          '% do total de DD',
        ],
        ...payload.directDebit.items.map((item) => [
          item.label,
          this.periodValue(item.directDebitCount, period, item.count),
          this.periodValue(
            item.teamTotalContracts,
            period,
            item.totalContractsForRegistrationName,
          ),
          this.periodValue(
            item.percentageOfTotalContractsByPeriod,
            period,
            item.percentageOfTotalContracts,
          ),
          this.safeRate(
            this.periodValue(
              item.teamTotalContracts,
              period,
              item.totalContractsForRegistrationName,
            ),
            this.periodValue(
              item.directDebitRateByPeriod,
              period,
              item.directDebitRate,
            ),
          ),
          this.periodValue(
            item.percentageByPeriod,
            period,
            item.percentage,
          ),
        ]),
      ],
    };
    const svaSheet = this.distributionSheet(
      'SVA',
      'SVA',
      payload.sva.distribution,
      period,
    );

    const chartSheet: ExcelSheetDefinition = {
      name: 'Gráficos',
      titleRows: [1],
      rows: [
        ['Dashboard Analytics · Visualização gráfica'],
        ['Comercializadora', payload.providerLabel],
        ['Período', payload.periodLabel],
        ['Nota', 'Os gráficos usam os mesmos dados exportados nas folhas detalhadas.'],
      ],
      charts: this.buildCharts(payload),
    };

    return [
      summarySheet,
      chartSheet,
      statesSheet,
      registrationNamesSheet,
      productsSheet,
      segmentsSheet,
      directDebitSheet,
      svaSheet,
    ];
  }

  private buildCharts(payload: AnalyticsExcelExportPayload): ExcelChartDefinition[] {
    const period = payload.period;
    const charts: Array<ExcelChartDefinition | null> = [
      this.distributionChart(
        `Contratos ${payload.providerLabel} por Estado`,
        payload.states.items,
        period,
      ),
      this.distributionChart(
        `${payload.providerLabel} por Tipo de Produto`,
        payload.products.items,
        period,
      ),
      this.distributionChart(
        `${payload.providerLabel} por Segmento`,
        payload.segments.items,
        period,
      ),
      this.distributionChart(
        'SVA · Com e sem SVA',
        payload.sva.distribution,
        period,
      ),
      this.distributionChart(
        `${payload.providerLabel} por Nome Registo C.U.`,
        payload.registrationNames.items,
        period,
        12,
      ),
      this.directDebitChart(payload),
    ];

    return charts.filter((chart): chart is ExcelChartDefinition => chart !== null);
  }

  private distributionChart(
    title: string,
    items: readonly AnalyticsDistributionItem[],
    period: AnalyticsPeriod,
    limit = 10,
  ): ExcelChartDefinition | null {
    const visibleItems = items
      .map((item) => ({
        label: item.label,
        value: this.periodValue(item.counts, period, item.count),
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);

    if (!visibleItems.length) {
      return null;
    }

    return {
      title,
      categories: visibleItems.map((item) => item.label),
      series: [
        {
          name: 'Contratos',
          values: visibleItems.map((item) => item.value),
          color: '008DB1',
        },
      ],
    };
  }

  private directDebitChart(
    payload: AnalyticsExcelExportPayload,
  ): ExcelChartDefinition | null {
    const period = payload.period;
    const items = payload.directDebit.items
      .map((item) => ({
        label: item.label,
        count: this.periodValue(item.directDebitCount, period, item.count),
        crmWeight: this.periodValue(
          item.percentageOfTotalContractsByPeriod,
          period,
          item.percentageOfTotalContracts,
        ),
        teamRate: this.safeRate(
          this.periodValue(
            item.teamTotalContracts,
            period,
            item.totalContractsForRegistrationName,
          ),
          this.periodValue(
            item.directDebitRateByPeriod,
            period,
            item.directDebitRate,
          ),
        ),
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    if (!items.length) {
      return null;
    }

    return {
      title: `Débito Direto ${payload.providerLabel} por Nome Registo C.U.`,
      categories: items.map((item) => item.label),
      percentage: true,
      series: [
        {
          name: 'Peso no CRM',
          values: items.map((item) => this.percentageFraction(item.crmWeight)),
          color: '008DB1',
        },
        {
          name: 'Taxa por Equipa',
          values: items.map((item) => this.percentageFraction(item.teamRate)),
          color: '415A6B',
        },
      ],
    };
  }

  private percentageFraction(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    return Math.min(1, value / 100);
  }

  private distributionSheet(
    name: string,
    labelHeader: string,
    items: readonly AnalyticsDistributionItem[],
    period: AnalyticsPeriod,
  ): ExcelSheetDefinition {
    return {
      name,
      headerRows: [1],
      freezeHeader: true,
      rows: [
        [labelHeader, 'Quantidade', 'Percentagem (%)'],
        ...items.map((item) => [
          item.label,
          this.periodValue(item.counts, period, item.count),
          this.periodValue(item.percentages, period, item.percentage),
        ]),
      ],
    };
  }

  private periodValue(
    values: AnalyticsPeriodValues | undefined,
    period: AnalyticsPeriod,
    allFallback = 0,
  ): number {
    const value = values?.[period];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return period === 'all' && Number.isFinite(allFallback) ? allFallback : 0;
  }

  private safeRate(teamTotal: number, rate: number): number {
    if (teamTotal <= 0 || !Number.isFinite(rate)) {
      return 0;
    }

    return rate;
  }

  private buildFilename(
    provider: AnalyticsProviderId,
    period: AnalyticsPeriod,
  ): string {
    const providerSlug = provider === 'galp-power-gas' ? 'galp-power-gas' : 'repsol';
    const periodSlug: Record<AnalyticsPeriod, string> = {
      last7Days: 'ultimos-7-dias',
      last30Days: 'ultimos-30-dias',
      currentYear: 'este-ano',
      all: 'sempre',
    };

    const date = new Intl.DateTimeFormat('sv-SE').format(new Date());
    return `analytics-${providerSlug}-${periodSlug[period]}-${date}.xlsx`;
  }

  private downloadFile(bytes: Uint8Array, filename: string): void {
    const blobBytes = Uint8Array.from(bytes);
    const blob = new Blob([blobBytes.buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /**
   * Gera um XLSX OpenXML válido sem adicionar uma biblioteca pesada ao bundle.
   * O ZIP usa o método STORE (sem compressão), que é suportado pelo formato XLSX.
   */
  /**
   * Gera um XLSX OpenXML válido sem adicionar uma biblioteca pesada ao bundle.
   * O ZIP usa o método STORE (sem compressão), que é suportado pelo formato XLSX.
   */
  private buildXlsx(sheets: readonly ExcelSheetDefinition[]): Uint8Array {
    const drawingContexts = this.buildDrawingContexts(sheets);
    const chartCount = drawingContexts.reduce(
      (total, context) => total + context.charts.length,
      0,
    );

    const entries: ZipEntry[] = [
      {
        name: '[Content_Types].xml',
        data: this.encode(
          this.contentTypesXml(sheets.length, drawingContexts.length, chartCount),
        ),
      },
      { name: '_rels/.rels', data: this.encode(this.rootRelationshipsXml()) },
      { name: 'xl/workbook.xml', data: this.encode(this.workbookXml(sheets)) },
      {
        name: 'xl/_rels/workbook.xml.rels',
        data: this.encode(this.workbookRelationshipsXml(sheets.length)),
      },
      { name: 'xl/styles.xml', data: this.encode(this.stylesXml()) },
      ...sheets.map((sheet, index) => ({
        name: `xl/worksheets/sheet${index + 1}.xml`,
        data: this.encode(
          this.worksheetXml(
            sheet,
            drawingContexts.some((context) => context.sheetIndex === index),
          ),
        ),
      })),
    ];

    for (const context of drawingContexts) {
      entries.push(
        {
          name: `xl/worksheets/_rels/sheet${context.sheetIndex + 1}.xml.rels`,
          data: this.encode(this.worksheetDrawingRelationshipsXml(context.drawingIndex)),
        },
        {
          name: `xl/drawings/drawing${context.drawingIndex}.xml`,
          data: this.encode(this.drawingXml(context)),
        },
        {
          name: `xl/drawings/_rels/drawing${context.drawingIndex}.xml.rels`,
          data: this.encode(this.drawingRelationshipsXml(context)),
        },
      );

      context.charts.forEach((chart, chartOffset) => {
        const chartIndex = context.chartStartIndex + chartOffset;
        entries.push({
          name: `xl/charts/chart${chartIndex}.xml`,
          data: this.encode(this.chartXml(chart, chartIndex)),
        });
      });
    }

    return this.createStoredZip(entries);
  }

  private buildDrawingContexts(
    sheets: readonly ExcelSheetDefinition[],
  ): ExcelDrawingContext[] {
    const contexts: ExcelDrawingContext[] = [];
    let drawingIndex = 1;
    let chartStartIndex = 1;

    sheets.forEach((sheet, sheetIndex) => {
      if (!sheet.charts?.length) {
        return;
      }

      contexts.push({
        sheetIndex,
        drawingIndex,
        chartStartIndex,
        charts: sheet.charts,
      });

      chartStartIndex += sheet.charts.length;
      drawingIndex += 1;
    });

    return contexts;
  }

  private contentTypesXml(
    sheetCount: number,
    drawingCount: number,
    chartCount: number,
  ): string {
    const worksheets = Array.from({ length: sheetCount }, (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    ).join('');
    const drawings = Array.from({ length: drawingCount }, (_, index) =>
      `<Override PartName="/xl/drawings/drawing${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
    ).join('');
    const charts = Array.from({ length: chartCount }, (_, index) =>
      `<Override PartName="/xl/charts/chart${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
    ).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      worksheets +
      drawings +
      charts +
      `</Types>`;
  }

  private rootRelationshipsXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`;
  }

  private workbookXml(sheets: readonly ExcelSheetDefinition[]): string {
    const sheetNodes = sheets
      .map(
        (sheet, index) =>
          `<sheet name="${this.escapeXmlAttribute(this.sanitizeSheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets>${sheetNodes}</sheets>` +
      `</workbook>`;
  }

  private workbookRelationshipsXml(sheetCount: number): string {
    const sheetRelationships = Array.from({ length: sheetCount }, (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    ).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheetRelationships +
      `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`;
  }

  private stylesXml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<fonts count="3">` +
      `<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>` +
      `<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>` +
      `<font><b/><color rgb="FF243646"/><sz val="16"/><name val="Calibri"/><family val="2"/></font>` +
      `</fonts>` +
      `<fills count="4">` +
      `<fill><patternFill patternType="none"/></fill>` +
      `<fill><patternFill patternType="gray125"/></fill>` +
      `<fill><patternFill patternType="solid"><fgColor rgb="FF008DB1"/><bgColor indexed="64"/></patternFill></fill>` +
      `<fill><patternFill patternType="solid"><fgColor rgb="FFE5F5F9"/><bgColor indexed="64"/></patternFill></fill>` +
      `</fills>` +
      `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="3">` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
      `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>` +
      `<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
      `</cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`;
  }

  private worksheetXml(
    sheet: ExcelSheetDefinition,
    hasDrawing = false,
  ): string {
    const widths = this.calculateColumnWidths(sheet.rows);
    const columns = widths
      .map(
        (width, index) =>
          `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
      )
      .join('');

    const rows = sheet.rows
      .map((row, rowIndex) => {
        const excelRow = rowIndex + 1;
        const style = sheet.titleRows?.includes(excelRow)
          ? 2
          : sheet.headerRows?.includes(excelRow)
            ? 1
            : 0;
        const cells = row
          .map((value, columnIndex) =>
            this.cellXml(value, excelRow, columnIndex + 1, style),
          )
          .join('');

        return `<row r="${excelRow}">${cells}</row>`;
      })
      .join('');

    const freezePane = sheet.freezeHeader
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;

    const drawing = hasDrawing ? `<drawing r:id="rId1"/>` : '';
    const relationshipsNamespace = hasDrawing
      ? ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`
      : '';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"${relationshipsNamespace}>` +
      freezePane +
      `<cols>${columns}</cols>` +
      `<sheetData>${rows}</sheetData>` +
      drawing +
      `</worksheet>`;
  }

  private worksheetDrawingRelationshipsXml(drawingIndex: number): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIndex}.xml"/>` +
      `</Relationships>`;
  }

  private drawingRelationshipsXml(context: ExcelDrawingContext): string {
    const relationships = context.charts
      .map((_, index) => {
        const chartIndex = context.chartStartIndex + index;
        return `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartIndex}.xml"/>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      relationships +
      `</Relationships>`;
  }

  private drawingXml(context: ExcelDrawingContext): string {
    const anchors = context.charts
      .map((_, index) => {
        const columnGroup = index % 2;
        const rowGroup = Math.floor(index / 2);
        const fromCol = columnGroup === 0 ? 0 : 8;
        const toCol = columnGroup === 0 ? 7 : 15;
        const fromRow = 5 + rowGroup * 18;
        const toRow = fromRow + 16;
        const chartIndex = context.chartStartIndex + index;

        return `<xdr:twoCellAnchor>` +
          `<xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
          `<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
          `<xdr:graphicFrame macro="">` +
          `<xdr:nvGraphicFramePr><xdr:cNvPr id="${index + 2}" name="Chart ${chartIndex}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
          `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
          `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
          `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${index + 1}"/>` +
          `</a:graphicData></a:graphic>` +
          `</xdr:graphicFrame>` +
          `<xdr:clientData/>` +
          `</xdr:twoCellAnchor>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
      anchors +
      `</xdr:wsDr>`;
  }

  private chartXml(chart: ExcelChartDefinition, chartIndex: number): string {
    const categoryAxisId = 100000 + chartIndex * 2;
    const valueAxisId = categoryAxisId + 1;
    const valueFormat = chart.percentage ? '0%' : '0';
    const seriesXml = chart.series
      .map((series, seriesIndex) => this.chartSeriesXml(
        series,
        seriesIndex,
        chart.categories,
        valueFormat,
      ))
      .join('');
    const legend = chart.series.length > 1
      ? `<c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/></c:legend>`
      : '';
    const dataLabels = chart.series.length === 1
      ? `<c:dLbls><c:numFmt formatCode="${valueFormat}" sourceLinked="0"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`
      : '';
    const percentageMax = chart.percentage ? `<c:max val="1"/>` : '';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
      `<c:date1904 val="0"/><c:lang val="pt-PT"/><c:roundedCorners val="0"/>` +
      `<c:chart>` +
      `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pt-PT" sz="1200" b="1"/><a:t>${this.escapeXmlText(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>` +
      `<c:autoTitleDeleted val="0"/>` +
      `<c:plotArea><c:layout/>` +
      `<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/>` +
      seriesXml +
      dataLabels +
      `<c:gapWidth val="65"/><c:overlap val="0"/><c:axId val="${categoryAxisId}"/><c:axId val="${valueAxisId}"/></c:barChart>` +
      `<c:catAx><c:axId val="${categoryAxisId}"/><c:scaling><c:orientation val="maxMin"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:tickLblPos val="nextTo"/><c:crossAx val="${valueAxisId}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>` +
      `<c:valAx><c:axId val="${valueAxisId}"/><c:scaling><c:min val="0"/>${percentageMax}</c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorGridlines/><c:numFmt formatCode="${valueFormat}" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="${categoryAxisId}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>` +
      `</c:plotArea>` +
      legend +
      `<c:plotVisOnly val="1"/><c:dispBlanksAs val="zero"/><c:showDLblsOverMax val="0"/>` +
      `</c:chart>` +
      `<c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings>` +
      `</c:chartSpace>`;
  }

  private chartSeriesXml(
    series: ExcelChartSeries,
    index: number,
    categories: readonly string[],
    valueFormat: string,
  ): string {
    const categoriesXml = categories
      .map((category, pointIndex) =>
        `<c:pt idx="${pointIndex}"><c:v>${this.escapeXmlText(category)}</c:v></c:pt>`,
      )
      .join('');
    const valuesXml = series.values
      .map((value, pointIndex) =>
        `<c:pt idx="${pointIndex}"><c:v>${Number.isFinite(value) ? value : 0}</c:v></c:pt>`,
      )
      .join('');

    return `<c:ser>` +
      `<c:idx val="${index}"/><c:order val="${index}"/>` +
      `<c:tx><c:v>${this.escapeXmlText(series.name)}</c:v></c:tx>` +
      `<c:spPr><a:solidFill><a:srgbClr val="${series.color}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>` +
      `<c:cat><c:strLit><c:ptCount val="${categories.length}"/>${categoriesXml}</c:strLit></c:cat>` +
      `<c:val><c:numLit><c:formatCode>${valueFormat}</c:formatCode><c:ptCount val="${series.values.length}"/>${valuesXml}</c:numLit></c:val>` +
      `</c:ser>`;
  }

  private cellXml(
    value: ExcelCellValue,
    row: number,
    column: number,
    style: number,
  ): string {
    if (value === null || value === undefined) {
      return '';
    }

    const reference = `${this.columnName(column)}${row}`;
    const styleAttribute = style > 0 ? ` s="${style}"` : '';

    if (typeof value === 'number') {
      const safeValue = Number.isFinite(value) ? value : 0;
      return `<c r="${reference}"${styleAttribute}><v>${safeValue}</v></c>`;
    }

    if (typeof value === 'boolean') {
      return `<c r="${reference}" t="b"${styleAttribute}><v>${value ? 1 : 0}</v></c>`;
    }

    return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${this.escapeXmlText(value)}</t></is></c>`;
  }

  private calculateColumnWidths(rows: readonly ExcelCellValue[][]): number[] {
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

    return Array.from({ length: columnCount }, (_, columnIndex) => {
      const maxLength = rows.reduce((max, row) => {
        const value = row[columnIndex];
        const length = value === null || value === undefined ? 0 : String(value).length;
        return Math.max(max, length);
      }, 0);

      return Math.min(42, Math.max(12, maxLength + 2));
    });
  }

  private sanitizeSheetName(name: string): string {
    return name.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Sheet';
  }

  private escapeXmlText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeXmlAttribute(value: string): string {
    return this.escapeXmlText(value)
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private columnName(column: number): string {
    let result = '';
    let current = column;

    while (current > 0) {
      current -= 1;
      result = String.fromCharCode(65 + (current % 26)) + result;
      current = Math.floor(current / 26);
    }

    return result;
  }

  private encode(value: string): Uint8Array {
    return new TextEncoder().encode(value);
  }

  private createStoredZip(entries: readonly ZipEntry[]): Uint8Array {
    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;
    const now = new Date();
    const { dosDate, dosTime } = this.toDosDateTime(now);

    for (const entry of entries) {
      const fileName = this.encode(entry.name);
      const crc = this.crc32(entry.data);
      const localHeader = new Uint8Array(30 + fileName.length);
      const localView = new DataView(localHeader.buffer);

      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, dosTime, true);
      localView.setUint16(12, dosDate, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, entry.data.length, true);
      localView.setUint32(22, entry.data.length, true);
      localView.setUint16(26, fileName.length, true);
      localView.setUint16(28, 0, true);
      localHeader.set(fileName, 30);

      localParts.push(localHeader, entry.data);

      const centralHeader = new Uint8Array(46 + fileName.length);
      const centralView = new DataView(centralHeader.buffer);

      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, dosTime, true);
      centralView.setUint16(14, dosDate, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, entry.data.length, true);
      centralView.setUint32(24, entry.data.length, true);
      centralView.setUint16(28, fileName.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, offset, true);
      centralHeader.set(fileName, 46);
      centralParts.push(centralHeader);

      offset += localHeader.length + entry.data.length;
    }

    const centralDirectory = this.concatBytes(centralParts);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);

    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralDirectory.length, true);
    endView.setUint32(16, offset, true);
    endView.setUint16(20, 0, true);

    return this.concatBytes([...localParts, centralDirectory, end]);
  }

  private concatBytes(parts: readonly Uint8Array[]): Uint8Array {
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;

    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }

    return output;
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xffffffff;

    for (const byte of data) {
      crc ^= byte;

      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  private toDosDateTime(date: Date): { dosDate: number; dosTime: number } {
    const year = Math.max(1980, date.getFullYear());
    const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);

    return { dosDate, dosTime };
  }
}
