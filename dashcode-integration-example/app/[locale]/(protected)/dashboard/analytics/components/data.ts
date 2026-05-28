type CompanyData = {
  company: string;
  category: string;
  views: number;
  revenue: string;
  sales: number;
  up: boolean;
};

type ActivityData = {
  id: number;
  img: string;
  description: string;
  time: string;
};

export const data: CompanyData[] = [];

export const activity: ActivityData[] = [];
