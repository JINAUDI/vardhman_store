"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useConfig } from "@/hooks/use-config"
import { useMenuHoverConfig } from "@/hooks/use-menu-hover"
import { motion } from "framer-motion"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

const groups = [
    {
        label: "Store",
        teams: [
            {
                label: "Radios Store",
                value: "personal",
            },
        ],
    },
    {
        label: "Teams",
        teams: [
            {
                label: "Core Workspace",
                value: "acme-inc",
            },
            {
                label: "Dev.Workspace",
                value: "monsters",
            },
        ],
    },
]

type Team = (typeof groups)[number]["teams"][number]

type PopoverTriggerProps = React.ComponentPropsWithoutRef<typeof PopoverTrigger>

interface TeamSwitcherProps extends PopoverTriggerProps { }

export default function TeamSwitcher({ className }: TeamSwitcherProps) {
    const [config] = useConfig()
    const [hoverConfig] = useMenuHoverConfig()
    const { hovered } = hoverConfig
    const [profile, setProfile] = React.useState({
        name: "Nitin Jain",
        image: "/images/avatar/avatar-1.png",
    })
    const [open, setOpen] = React.useState(false)
    const [selectedTeam, setSelectedTeam] = React.useState<Team>(
        groups[0].teams[0]
    )

    React.useEffect(() => {
        let isMounted = true
        const supabase = getSupabaseBrowserClient()

        supabase.auth.getUser().then(({ data }) => {
            if (!isMounted || !data.user) return
            const metadata = data.user.user_metadata || {}
            setProfile({
                name: String(metadata.full_name || metadata.name || data.user.email || "Nitin Jain"),
                image: String(metadata.avatar_url || "/images/avatar/avatar-1.png"),
            })
        })

        return () => {
            isMounted = false
        }
    }, [])

    if (config.showSwitcher === false || config.sidebar === "compact") return null

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <motion.div
                    key={(config.collapsed && !hovered) ? "collapsed" : "expanded"}
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    {(config.collapsed && !hovered) ? (
                        <Button
                            variant="outline"
                            color="secondary"
                            role="combobox"
                            fullWidth
                            aria-expanded={open}
                            aria-label="Select a team"
                            className={cn("h-14 w-14 mx-auto p-0 md:p-0 dark:border-secondary ring-offset-sidebar", className)}
                        >
                            <Avatar>
                                <AvatarImage
                                    height={24}
                                    width={24}
                                    src={profile.image}
                                    alt={selectedTeam.label}
                                    className="grayscale"
                                />
                                <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            color="secondary"
                            role="combobox"
                            fullWidth
                            aria-expanded={open}
                            aria-label="Select a team"
                            className={cn("h-auto py-3 md:px-3 px-3 justify-start dark:border-secondary ring-offset-sidebar", className)}
                        >
                            <div className="flex gap-2 flex-1 items-center">
                                <Avatar className="flex-none h-[38px] w-[38px]">
                                    <AvatarImage
                                        height={38}
                                        width={38}
                                        src={profile.image}
                                        alt={selectedTeam.label}
                                        className="grayscale"
                                    />
                                    <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-start w-[100px]">
                                    <div className="text-sm font-semibold text-default-900">
                                        {profile.name.includes("@") ? "Nitin Jain" : profile.name}
                                    </div>
                                    <div className="text-xs font-normal text-default-500 dark:text-default-700 truncate">
                                        Radios Store
                                    </div>
                                </div>
                                <ChevronsUpDown className="ml-auto h-5 w-5 shrink-0 text-default-500 dark:text-default-700" />
                            </div>
                        </Button>
                    )}
                </motion.div>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandList>
                        <CommandInput placeholder="Search team..." className="placeholder:text-xs" />
                        <CommandEmpty>No team found.</CommandEmpty>
                        {groups.map((group) => (
                            <CommandGroup key={group.label} heading={group.label}>
                                {group.teams.map((team) => (
                                    <CommandItem
                                        key={team.value}
                                        onSelect={() => {
                                            setSelectedTeam(team)
                                            setOpen(false)
                                        }}
                                        className="text-sm font-normal"
                                    >
                                        {team.label}
                                        <Check
                                            className={cn(
                                                "ml-auto h-4 w-4",
                                                selectedTeam.value === team.value
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
