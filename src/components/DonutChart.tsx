import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

type DonutChartProps = {
  data: { name: string; value: number }[];
  title?: string;
};

const COLORS = ['#34D399', '#3B82F6', '#FBBF24', '#F87171', '#A78BFA'];

const DonutChart: React.FC<DonutChartProps> = ({ data, title }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      {title && <h3 className="font-semibold mb-2">{title}</h3>}
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DonutChart;