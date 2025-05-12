import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, ChartOptions } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(ArcElement, ChartDataLabels);

interface DonutChartProps {
  value: number;
  total: number;
  color: string;
  label: string;
}

const DonutChart: React.FC<DonutChartProps> = ({ value, total, color, label }) => {
  const safeTotal = total === 0 ? 1 : total;

  const data = {
    datasets: [
      {
        data: [value, safeTotal - value],
        backgroundColor: [color, '#e5e7eb'],
        borderWidth: 0,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    cutout: '55%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      datalabels: {
        display: true,
        color: '#1e3a8a',
        font: {
          weight: 'bold',
          size: 22,
        },
        formatter: () => value,
        anchor: 'center',
        align: 'center',
      },
    },
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-24 h-24">
        <Doughnut data={data} options={options} />
      </div>
      <p className="mt-2 text-sm text-gray-600">{label}</p>
    </div>
  );
};

export default DonutChart;
