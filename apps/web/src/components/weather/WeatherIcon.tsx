import { getWeatherIcon } from "../../lib/weather-utils";

interface WeatherIconProps {
  code: number;
  isDay?: boolean;
  size?: number;
  className?: string;
  label?: string;
}

export function WeatherIcon({
  code,
  isDay = true,
  size = 24,
  className,
  label,
}: WeatherIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={getWeatherIcon(code, isDay)} />
    </svg>
  );
}
