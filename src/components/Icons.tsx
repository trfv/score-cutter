import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const defaults: IconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return <svg {...defaults} {...props}>{children}</svg>;
}

export function Sun(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" />
    </Icon>
  );
}

export function Moon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.5 11.5a6 6 0 0 1-7-7 6 6 0 1 0 7 7Z" />
    </Icon>
  );
}

export function ChevronLeft(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12.5 4.5 7 10l5.5 5.5" />
    </Icon>
  );
}

export function ChevronRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 4.5 13 10l-5.5 5.5" />
    </Icon>
  );
}

export function Check(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 10.5 3 3 7-7" />
    </Icon>
  );
}

export function Download(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5M4 16h12" />
    </Icon>
  );
}

export function Archive(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="3" width="16" height="4" rx="1" />
      <path d="M3 7v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M8 11h4" />
    </Icon>
  );
}

export function AlertTriangle(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3 1.5 17.5h17L10 3Z" />
      <path d="M10 8v4M10 14.5v.5" />
    </Icon>
  );
}

export function Globe(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M2.5 10h15M10 2.5c-2 2.5-3 5-3 7.5s1 5 3 7.5M10 2.5c2 2.5 3 5 3 7.5s-1 5-3 7.5" />
    </Icon>
  );
}
