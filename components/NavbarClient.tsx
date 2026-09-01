"use client";

import { authClient } from "@/app/lib/auth-client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

import { Menu } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { Montserrat } from "next/font/google";
import { motion } from "framer-motion";

const montserrat = Montserrat({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

type NavbarClientProps = {
    isAdmin: boolean;
    notifications: number;
};

export default function NavbarClient({ isAdmin, notifications }: NavbarClientProps) {

    const dropdownContainer = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: 0.045,
                delayChildren: 0.04,
            },
        },
    };

    const dropdownItem = {
        hidden: {
            opacity: 0,
            x: 8,
        },
        visible: {
            opacity: 1,
            x: 0,
            transition: {
                type: "spring" as const,
                stiffness: 500,
                damping: 30,
            },
        },
    };

    const navLinksLP = [
        { name: "Home", href: "/" },
        { name: "Onboarding", href: "/onboarding" },
        { name: "Contact", href: "/contact" },
    ];

    const navLinksAuth = [
        { name: "Home", href: "/" },
        { name: "Dashboard", href: "/dashboard" },
        { name: "Onboarding", href: "/onboarding" },
        { name: "Contact", href: "/contact" },
    ];

    const router = useRouter();
    const pathname = usePathname();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState<{ name: string; email: string; image: string, notifications: number } | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    // Fetch session using Better Auth
    useEffect(() => {
        const fetchSession = async () => {
            try {
                const { data, error } = await authClient.getSession();
                if (error) console.error("Session fetch error:", error);
                else if (data?.session) {
                    setIsLoggedIn(true);
                    setUser({
                        name: data.user.name || "User",
                        email: data.user.email || "",
                        image: data.user.image || "/avatar.png",
                        notifications: notifications || 0,
                    });

                } else setIsLoggedIn(false);
            } catch (err) {
                console.error("Session error:", err);
            }
        };

        fetchSession();
    }, [pathname]);

    const handleLogout = async () => {
        await authClient.signOut();
        setIsLoggedIn(false);
        sessionStorage.removeItem("show-login-toast");
        setSheetOpen(false);
        toast.success("Logged out successfully.", { duration: 1500 });
        router.replace("/");
    };


    return (
        <nav className="fixed top-4 left-1/2 z-50 w-[calc(100%-24px)] px-4 md:px-2 max-w-7xl -translate-x-1/2"
            style={montserrat.style}
        >
            <div className="rounded-3xl shadow-lg shadow-black/50 bg-linear-to-r from-[#0a5e6b]/70 backdrop-blur-sm via-[#073338]/90 to-[#000000]/90">

                <div className="mx-auto flex items-center justify-between gap-3 px-4 py-2.5 md:px-4">

                    {/* Mobile Menu */}
                    <div className="md:hidden flex items-center">
                        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="
                                
                                rounded-full
                                text-white/80
                                hover:bg-white/10
                                hover:text-white
                                 p-0
                                 aspect-square 
                                justify-start
                            "
                                >
                                    <Menu className="size-5" />
                                </Button>
                            </SheetTrigger>

                            <SheetContent
                                side="left"
                                className="
                            w-75
                            border-white/10
                            bg-[#06101d]
                            p-0
                            text-white
                        "
                            >
                                <SheetHeader className="border-b border-white/10 p-6">
                                    <SheetTitle className="flex items-center gap-3 text-white">
                                        <Image
                                            src="/logo.png"
                                            alt="Schemae Logo"
                                            width={40}
                                            height={40}
                                            className="rounded-full object-center object-contain"
                                        />
                                        Schemae
                                    </SheetTitle>
                                </SheetHeader>

                                {/* User */}
                                {isLoggedIn && (
                                    <div className="flex items-center gap-4 border-b border-white/10 px-6 py-5">
                                        <Avatar className="h-12 w-12 border border-white/10 ">
                                            <AvatarImage
                                                className=" object-top object-cover"
                                                src={user?.image || "/avatar.png"}
                                            />
                                            <AvatarFallback className="bg-white/10 text-white">
                                                {user?.name?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div>
                                            <p className="font-semibold text-white">
                                                {user?.name}
                                            </p>

                                            <p className="text-sm text-white/50">
                                                Welcome back
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Mobile Links */}
                                <div className="flex flex-col py-4">

                                    {isLoggedIn ? (
                                        <>
                                            {isAdmin && (
                                                <Link
                                                    href="/admin"
                                                    onClick={() => setSheetOpen(false)}
                                                    className={`
                                                mx-3 rounded-xl px-4 py-3
                                                transition
                                                ${pathname === "/admin"
                                                            ? "bg-yellow-400 text-slate-950 font-semibold"
                                                            : "text-white/75 hover:bg-white/6 hover:text-white"
                                                        }
                                            `}
                                                >
                                                    Admin
                                                </Link>
                                            )}

                                            {navLinksAuth.map((link) => (
                                                <Link
                                                    key={link.href}
                                                    href={link.href}
                                                    onClick={() => setSheetOpen(false)}
                                                    className={`
                                                mx-3 rounded-xl px-4 py-3
                                                transition
                                                text-sm
                                                ${pathname === link.href
                                                            ? "bg-white/30 text-white font-semibold"
                                                            : "text-white/75 hover:bg-white/6 hover:text-white"
                                                        }
                                            `}
                                                >
                                                    {link.name}
                                                </Link>
                                            ))}

                                            <Link
                                                href="/profile"
                                                onClick={() => setSheetOpen(false)}
                                                className="
                                            mx-3 rounded-xl px-4 py-3
                                            text-white/75
                                            transition
                                            hover:bg-white/6
                                            hover:text-white
                                            text-sm
                                        "
                                            >
                                                Profile
                                            </Link>

                                            <button
                                                onClick={handleLogout}
                                                className="
                                            mx-3 rounded-xl px-4 py-3
                                            text-left text-red-400
                                            transition
                                            hover:bg-red-500/10
                                            text-sm
                                        "
                                            >
                                                Logout
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {navLinksLP.map((link) => (
                                                <Link
                                                    key={link.href}
                                                    href={link.href}
                                                    onClick={() => setSheetOpen(false)}
                                                    className={`
                                                mx-3 rounded-xl px-4 py-3
                                                transition
                                                text-sm
                                                ${pathname === link.href
                                                            ? "bg-white/15 border border-white/30 text-white font-semibold"
                                                            : "text-white/75 hover:bg-white/6 hover:text-white"
                                                        }
                                            `}
                                                >
                                                    {link.name}
                                                </Link>
                                            ))}

                                            <div className="mt-6 flex flex-col gap-3 px-6">
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    onClick={() => setSheetOpen(false)}
                                                    className="
                                                bg-white/15
                                                text-white
                                                border border-white/30
                                                hover:bg-white/20
                                                hover:text-white
                                                transition
                                                text-sm
                                            "
                                                >
                                                    <Link href="/signin">
                                                        Sign In
                                                    </Link>
                                                </Button>

                                                <Button
                                                    asChild
                                                    onClick={() => setSheetOpen(false)}
                                                    className="
                                                bg-white/20
                                                text-white
                                                border border-white/30
                                                hover:bg-white/30
                                                hover:text-white
                                                transition
                                                text-sm
                                            "
                                                >
                                                    <Link href="/signup">
                                                        Sign Up
                                                    </Link>
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </SheetContent>
                        </Sheet>

                        <Link href="/"
                            className="
                    flex shrink-0 items-center
                    
                    font-semibold
                    tracking-widest
                    text-white
                "
                        >
                            <span>
                                Schemae
                            </span>
                        </Link>

                    </div>

                    {/* Logo */}
                    <Link
                        href="/"
                        className="
                    flex shrink-0 items-center
                    text-lg
                    font-semibold
                    tracking-[0.2em]
                    text-white
                "
                    >
                        <Image
                            src="/logo.png"
                            alt="schemae Logo"
                            width={36}
                            height={36}
                            loading="eager"
                            fill={false}
                            className="rounded-full bg-red-100 object-contain object-center md:mr-6"
                        />

                        <span className="hidden md:block">
                            Schemae
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    {pathname === "/maintenance" ? null : isLoggedIn ? (
                        <div className="hidden md:flex items-center gap-3 tracking-wide">

                            {isAdmin && (
                                <Link
                                    href="/admin"
                                    className={`
                    relative
                    rounded-full
                    px-4 py-2
                    text-sm font-medium
                    transition-colors duration-200
                    ${pathname === "/admin"
                                            ? "text-white"
                                            : "text-white/70 hover:bg-white/6 hover:text-white"
                                        }
                `}
                                >
                                    {pathname === "/admin" && (
                                        <motion.span
                                            layoutId="navbar-active"
                                            className="
                            absolute
                            inset-0
                            rounded-full
                            border
                            border-white/30
                            bg-white/20
                        "
                                            transition={{
                                                type: "spring",
                                                stiffness: 420,
                                                damping: 32,
                                                mass: 0.8,
                                            }}
                                        />
                                    )}

                                    <span className="relative z-10">
                                        Admin
                                    </span>
                                </Link>
                            )}

                            {navLinksAuth.map((link) => {
                                const isActive = pathname === link.href;

                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`
                        relative
                        rounded-full
                        px-4 py-2
                        text-sm font-medium
                        transition-colors duration-200
                        ${isActive
                                                ? "text-white"
                                                : "text-white/70 hover:bg-white/6 hover:text-white"
                                            }
                    `}
                                    >
                                        {isActive && (
                                            <motion.span
                                                layoutId="navbar-active"
                                                className="
                                absolute
                                inset-0
                                rounded-full
                                border
                                border-white/30
                                bg-white/20
                            "
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 420,
                                                    damping: 32,
                                                    mass: 0.8,
                                                }}
                                            />
                                        )}

                                        <span className="relative z-10">
                                            {link.name}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="hidden md:flex items-center gap-3">

                            {navLinksLP.map((link) => {
                                const isActive = pathname === link.href;

                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`
                        relative
                        rounded-full
                        px-4 py-2
                        text-sm font-medium
                        transition-colors duration-200
                        ${isActive
                                                ? "text-white"
                                                : "text-white/70 hover:bg-white/6 hover:text-white"
                                            }
                    `}
                                    >
                                        {isActive && (
                                            <motion.span
                                                layoutId="navbar-active"
                                                className="
                                absolute
                                inset-0
                                rounded-full
                                border
                                border-white/30
                                bg-white/20
                            "
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 420,
                                                    damping: 32,
                                                    mass: 0.8,
                                                }}
                                            />
                                        )}

                                        <span className="relative z-10">
                                            {link.name}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}


                    {/* Right Side */}

                    {pathname !== "/maintenance" && (
                        <div className="hidden md:flex items-center gap-2 ">

                            {isLoggedIn ? (
                                <DropdownMenu
                                    open={menuOpen}
                                    onOpenChange={setMenuOpen}
                                >
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            className="
                                    flex items-center gap-2.5
                                    rounded-full
                                    px-4
                                    transition
                                    cursor-pointer
                                    outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0
                                "
                                        >

                                            <span className="text-sm font-medium tracking-wide text-white mr-4">
                                                {user?.name?.split(' ')[0] || "My Account"}
                                            </span>
                                            <motion.div
                                                animate={{
                                                    scale: menuOpen ? 1.06 : 1,
                                                    rotate: menuOpen ? 2 : 0,
                                                }}
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 500,
                                                    damping: 30,
                                                }}
                                                className="relative h-9 w-9 shrink-0"
                                            >
                                                <Avatar className="h-9 w-9 border border-white/10">
                                                    <AvatarImage
                                                        className="object-cover object-center"
                                                        src={user?.image || "/avatar.png"}
                                                        alt="@user"
                                                    />

                                                    <AvatarFallback className="bg-white/10 text-white">
                                                        {user?.name
                                                            ? user.name.charAt(0).toUpperCase()
                                                            : "U"}
                                                    </AvatarFallback>


                                                </Avatar>

                                                {(user?.notifications ?? 0) > 0 && (
                                                    <span className="absolute -top-1 -right-1 h-3 aspect-square rounded-full bg-red-500 border-2 border-white" />
                                                )}

                                            </motion.div>
                                        </button>
                                    </DropdownMenuTrigger>

                                    <DropdownMenuContent
                                        forceMount
                                        asChild
                                        align="end"
                                    >
                                        <motion.div
                                            initial={{
                                                opacity: 0,
                                                scale: 0.94,
                                                y: -6,
                                                transformOrigin: "top right",
                                            }}
                                            animate={{
                                                opacity: menuOpen ? 1 : 0,
                                                scale: menuOpen ? 1 : 0.94,
                                                y: menuOpen ? 0 : -6,
                                            }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 450,
                                                damping: 32,
                                                mass: 0.7,
                                            }}
                                            className="
            w-52
            rounded-xl
            border
            border-gray-200
            bg-white
            shadow-xl
            tracking-wide
            text-gray-800
        "
                                        >
                                            <DropdownMenuLabel className="flex items-center ">
                                                <Avatar className="h-7 w-7 mr-4 border border-black/40">
                                                    <AvatarImage
                                                        src={user?.image || "/avatars/user.png"}
                                                        className="object-cover object-center"
                                                        alt="@user"
                                                    />

                                                    <AvatarFallback className="bg-white/10 text-white">
                                                        {user?.name
                                                            ? user.name.charAt(0).toUpperCase()
                                                            : "U"}
                                                    </AvatarFallback>
                                                </Avatar>


                                                <span className="font-medium flex gap-0 flex-col">
                                                    <span className="text-xs text-gray-500">
                                                        Welcome,
                                                    </span>
                                                    {user?.name || "My Account"}
                                                </span>
                                            </DropdownMenuLabel>

                                            <DropdownMenuSeparator className="border border-gray-200" />

                                            <motion.div
                                                variants={dropdownContainer}
                                                initial="hidden"
                                                animate={menuOpen ? "visible" : "hidden"}
                                            >
                                                <DropdownMenuGroup>
                                                    <DropdownMenuItem
                                                        asChild
                                                        onClick={() => setMenuOpen(false)}
                                                    >
                                                        <motion.div
                                                            variants={dropdownItem}
                                                            className="
            cursor-pointer
            rounded-lg
            focus:bg-gray-200
            focus:text-black
        "
                                                        >
                                                            <Link
                                                                href="/dashboard"
                                                                className="flex w-full items-center gap-4"
                                                            >
                                                                <LayoutDashboard className="h-4 w-4" />
                                                                Dashboard
                                                            </Link>
                                                        </motion.div>
                                                    </DropdownMenuItem>

                                                    <DropdownMenuItem
                                                        asChild
                                                        onClick={() => setMenuOpen(false)}
                                                    >
                                                        <motion.div
                                                            variants={dropdownItem}
                                                            className="
            cursor-pointer
            rounded-lg
            focus:bg-gray-200
            focus:text-black
            relative
        "
                                                        >
                                                            <Link
                                                                href="/profile"
                                                                className="flex w-full items-center gap-4"
                                                            >
                                                                <User className="h-4 w-4" />
                                                                Profile
                                                            </Link>
                                                            {(user?.notifications ?? 0) > 0 && (
                                                                <span className="absolute right-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white border-2">
                                                                    {user?.notifications}
                                                                </span>
                                                            )}
                                                        </motion.div>
                                                    </DropdownMenuItem>

                                                </DropdownMenuGroup>
                                            </motion.div>

                                            <DropdownMenuSeparator className="border border-gray-200" />

                                            <DropdownMenuItem
                                                onClick={() => {
                                                    handleLogout();
                                                    setMenuOpen(false);
                                                }}
                                                className="
                                    cursor-pointer
                                    font-medium
                                    text-red-500
                                    focus:bg-red-500/10
                                    focus:text-red-400
                                "
                                            >
                                                <LogOut className="mr-2 h-4 w-4 text-red-500/60" />
                                                Logout
                                            </DropdownMenuItem>
                                        </motion.div>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <>
                                    <div className="relative flex items-center gap-2 rounded-full">
                                        {/* Active background */}
                                        {(pathname === "/signin" || pathname === "/signup") && (
                                            <motion.div
                                                layoutId="auth-active"
                                                className="
                pointer-events-none
                absolute
                inset-y-0
                left-0
                w-20.5
                rounded-full
                border border-white/30
                bg-white/20
            "
                                                animate={{
                                                    x: pathname === "/signin" ? 0 : 90,
                                                }}
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 500,
                                                    damping: 38,
                                                    mass: 0.7,
                                                }}
                                            />
                                        )}

                                        <Button
                                            asChild
                                            variant="ghost"
                                            className="
            relative z-10
            w-20.5
            rounded-full
            px-5
            text-white/80
            hover:bg-white/20
            hover:text-white
        "
                                        >
                                            <Link href="/signin">
                                                Sign In
                                            </Link>
                                        </Button>

                                        <Button
                                            asChild
                                            variant="ghost"
                                            className="
            relative z-10
            w-20.5
            rounded-full
            px-5
            text-white/80
            hover:bg-white/20
            hover:text-white
        "
                                        >
                                            <Link href="/signup">
                                                Sign Up
                                            </Link>
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </nav>
    );
}
