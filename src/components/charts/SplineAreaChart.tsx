'use client';

import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

// Importação dinâmica do ApexCharts para evitar problemas de SSR
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface SplineAreaChartProps {
  data: Array<{ mes: string; quantidade: number }>;
  title: string;
  color?: string;
  tipoMarcacao?: 'atendimento' | 'agendamento';
}

export function SplineAreaChart({ data, title, color = '#22c55e', tipoMarcacao = 'atendimento' }: SplineAreaChartProps) {
  // Preparar dados para o gráfico
  // Garantir que os dados estão na ordem correta (mais antigo à esquerda, mais recente à direita)
  const categories = data.map(item => item.mes);
  const series = data.map(item => item.quantidade);

  const options: ApexOptions = {
    chart: {
      type: 'area',
      height: 350,
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
      width: 3,
      colors: [color],
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 100],
        colorStops: [
          {
            offset: 0,
            color: color,
            opacity: 0.7,
          },
          {
            offset: 100,
            color: color,
            opacity: 0.1,
          },
        ],
      },
    },
    colors: [color],
    xaxis: {
      categories: categories,
      reversed: false, // Garantir que a ordem não seja invertida (mais antigo à esquerda, mais recente à direita)
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '12px',
        },
        rotate: -45, // Rotacionar labels se necessário para melhor visualização
        rotateAlways: false, // Só rotacionar se necessário
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: '#6b7280',
          fontSize: '12px',
        },
      },
      min: 0,
      tickAmount: 7, // Para ter intervalos de aproximadamente 2
      forceNiceScale: true,
    },
    grid: {
      borderColor: '#e5e7eb',
      strokeDashArray: 3,
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
          strokeDashArray: 3,
        },
      },
      padding: {
        top: 10,
        right: 10,
        bottom: 0,
        left: 0,
      },
    },
    tooltip: {
      theme: 'light',
      style: {
        fontSize: '12px',
      },
      y: {
        formatter: (value: number) => {
          const tipo = tipoMarcacao === 'agendamento' 
            ? (value === 1 ? 'agendamento' : 'agendamentos')
            : (value === 1 ? 'atendimento' : 'atendimentos');
          return `${value} ${tipo}`;
        },
      },
    },
    title: {
      text: title,
      align: 'left',
      style: {
        fontSize: '18px',
        fontWeight: 600,
        color: '#111827',
      },
      offsetX: 0,
      offsetY: 0,
    },
  };

  const chartSeries = [
    {
      name: 'Quantidade',
      data: series,
    },
  ];

  return (
    <div className="w-full">
      <Chart
        options={options}
        series={chartSeries}
        type="area"
        height={350}
      />
    </div>
  );
}

