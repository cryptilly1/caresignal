import Image from "next/image";

export function BrandMark({ centered = false }: { centered?: boolean }) {
  return <span className={`onboarding-brand-mark${centered ? " onboarding-brand-mark--centered" : ""}`} aria-label="CareSignal">
    <Image src="/images/welcome/heart-pulse.svg" width={24} height={24} alt="" priority />
  </span>;
}
