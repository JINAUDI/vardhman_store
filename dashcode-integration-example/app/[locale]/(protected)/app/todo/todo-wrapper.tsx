'use client'
import { useMediaQuery } from '@/hooks/use-media-query';
import { useTodoConfig } from '@/hooks/use-todo'

const TodoWrapper = ({ children }: { children: React.ReactNode }) => {
    const [todoConfig, setTodoConfig] = useTodoConfig();
    const { isOpen } = todoConfig
    const isTablet = useMediaQuery("(min-width: 1024px)");
    return (
        <div className='relative app-height'>
            {!isTablet && isOpen && (
                <div
                    onClick={() => setTodoConfig({ ...todoConfig, isOpen: false })}
                    className="overlay bg-default-900/60 backdrop-filter
         backdrop-blur-xs absolute w-full flex-1 inset-0 z-20 rounded-md"

                ></div>
            )}

            {children}
        </div>
    )
}

export default TodoWrapper