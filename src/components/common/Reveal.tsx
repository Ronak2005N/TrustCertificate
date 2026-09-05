import { motion } from "motion/react";
import type { ReactNode } from "react";

/** Subtle fade + slide-up on scroll. Motion respects prefers-reduced-motion. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold tracking-widest text-primary uppercase">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base text-muted-foreground">{description}</p>}
    </div>
  );
}
