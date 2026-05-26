import { Badge } from "@/components/ui/badge";

const GradientBadges = () => {
  return (
    <div className="flex flex-wrap gap-5">
      <Badge className="bg-linear-to-r from-primary to-success border-none">Primary</Badge>
      <Badge className="bg-linear-to-r from-secondary to-secondary/80 text-secondary-foreground border-none">Secondary</Badge>
      <Badge className="bg-linear-to-tr from-success to-info border-none">Success</Badge>
      <Badge className="bg-linear-to-tr from-info to-primary border-none">Info</Badge>
      <Badge className="bg-linear-to-r from-warning to-destructive border-none">Warning</Badge>
      <Badge className="bg-linear-to-r from-destructive to-warning border-none">Destructive</Badge>
    </div>
  );
};

export default GradientBadges;