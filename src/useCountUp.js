import { useEffect, useRef, useState } from "react";

export function useCountUp(target, ms = 650) {
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => {
        current.current = target;
        setValue(target);
      });
      return () => cancelAnimationFrame(frame);
    }
    const from = current.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      current.current = Math.round(from + (target - from) * eased);
      setValue(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return value;
}
