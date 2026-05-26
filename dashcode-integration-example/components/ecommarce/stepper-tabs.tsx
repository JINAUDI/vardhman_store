"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type StepConfig = {
  id: string;
  title: string;
  shortTitle?: string;
};

interface StepperTabsProps {
  steps: StepConfig[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
}

const StepperTabs: React.FC<StepperTabsProps> = ({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}) => {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center min-w-max px-2">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = completedSteps.has(index);
          const isClickable = isCompleted || index <= currentStep;

          return (
            <React.Fragment key={step.id}>
              {/* Step */}
              <button
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 group whitespace-nowrap",
                  isClickable && "cursor-pointer",
                  !isClickable && "cursor-not-allowed opacity-50",
                  isActive && "bg-primary/10"
                )}
              >
                {/* Step Number / Check */}
                <div
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold shrink-0 transition-all duration-200",
                    isCompleted
                      ? "bg-success text-success-foreground"
                      : isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-default-200 text-default-500"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Title */}
                <span
                  className={cn(
                    "text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "text-primary"
                      : isCompleted
                      ? "text-success"
                      : "text-default-500"
                  )}
                >
                  <span className="hidden sm:inline">{step.title}</span>
                  <span className="sm:hidden">
                    {step.shortTitle || step.title}
                  </span>
                </span>
              </button>

              {/* Connector */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-px w-8 mx-1 shrink-0 transition-colors duration-200",
                    isCompleted ? "bg-success" : "bg-default-200"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default StepperTabs;
