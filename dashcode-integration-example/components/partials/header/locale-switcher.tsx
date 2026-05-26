'use client';

import Image from 'next/image';

export default function LocalSwitcher() {
    return (
        <div className='flex items-center gap-1 w-[94px] px-3 py-2'>
            <Image
                src="/images/all-img/flag-india.png"
                alt='Indian flag'
                width={24}
                height={24}
                className='w-6 h-6 rounded-full'
            />
            <span className='font-medium text-sm text-default-600 dark:text-default-700'>En</span>
        </div>
    );
}