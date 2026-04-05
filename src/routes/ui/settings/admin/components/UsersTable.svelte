<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		UserCog,
		Ban,
		Unlock,
		Trash2,
		MoreHorizontal,
		Mail,
		Calendar,
		ShieldCheck,
		UserMinus
	} from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { toast } from 'svelte-sonner';

	type Props = {
		users: User[];
		currentUserId: string;
		onBanUser: (userId: string, isBanned: boolean) => void;
		onSetRole: (userId: string, currentRole: string) => void;
		requestConfirmation: (title: string, description: string, action: () => void) => void;
		refreshUsers: () => void;
	};

	type User = {
		id: string;
		name: string;
		email: string;
		role?: string;
		banned?: boolean | null;
		image?: string | null | undefined;
		createdAt: Date | string;
	};

	let { users, currentUserId, onBanUser, onSetRole, requestConfirmation, refreshUsers }: Props =
		$props();
</script>

<Card class="overflow-hidden border-none p-0 shadow-sm">
	<CardContent class="p-0">
		<Table.Root>
			<Table.Header class="bg-muted/30">
				<Table.Row>
					<Table.Head class="w-75 text-[10px] font-black tracking-widest uppercase">
						User
					</Table.Head>
					<Table.Head class="text-[10px] font-black tracking-widest uppercase">Role</Table.Head>
					<Table.Head class="text-[10px] font-black tracking-widest uppercase">Status</Table.Head>
					<Table.Head class="text-[10px] font-black tracking-widest uppercase">Joined</Table.Head>
					<Table.Head class="text-right text-[10px] font-black tracking-widest uppercase">
						Actions
					</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each users as user}
					<Table.Row class="group transition-colors hover:bg-background/50">
						<Table.Cell>
							<div class="flex items-center gap-4">
								<Avatar.Root class="h-10 w-10 rounded-xl border-2 border-background shadow-sm">
									<Avatar.Image src={user.image} alt={user.name} />
									<Avatar.Fallback class="bg-primary/10 font-black text-primary">
										{user.name.charAt(0).toUpperCase()}
									</Avatar.Fallback>
								</Avatar.Root>
								<div class="flex min-w-0 flex-col">
									<span class="truncate text-sm font-bold">{user.name}</span>
									<div class="text-muted-foreground flex items-center gap-1 text-[10px]">
										<Mail class="h-3 w-3" />
										<span class="truncate">{user.email}</span>
									</div>
								</div>
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="flex items-center gap-2">
								{#if user.role === 'admin'}
									<ShieldCheck class="h-3.5 w-3.5 text-primary" />
								{/if}
								<Badge
									variant={user.role === 'admin' ? 'default' : 'secondary'}
									class="rounded-lg px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase"
								>
									{user.role || 'user'}
								</Badge>
							</div>
						</Table.Cell>
						<Table.Cell>
							{#if user.banned}
								<Badge
									variant="destructive"
									class="rounded-lg px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase"
								>
									Banned
								</Badge>
							{:else}
								<Badge
									variant="outline"
									class="rounded-lg border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold tracking-widest text-primary uppercase"
								>
									Active
								</Badge>
							{/if}
						</Table.Cell>
						<Table.Cell>
							<div
								class="text-muted-foreground flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase"
							>
								<Calendar class="h-3.5 w-3.5" />
								{new Date(user.createdAt).toLocaleDateString(undefined, {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})}
							</div>
						</Table.Cell>
						<Table.Cell class="text-right">
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8 rounded-xl hover:bg-background hover:text-foreground"
									>
										<MoreHorizontal class="h-4 w-4" />
									</Button>
								</DropdownMenu.Trigger>
								<DropdownMenu.Content
									align="end"
									class="w-48 rounded-2xl border-none p-2 shadow-xl"
								>
									<DropdownMenu.Label
										class="text-muted-foreground px-2 py-1.5 text-[9px] font-black tracking-widest uppercase"
										>User Actions</DropdownMenu.Label
									>
									<DropdownMenu.Separator class="my-1" />
									<DropdownMenu.Item
										class="cursor-pointer gap-2 rounded-xl text-xs font-bold"
										onclick={() => onSetRole(user.id, user.role || 'user')}
									>
										<UserCog class="h-4 w-4" />
										{user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class={cn(
											'cursor-pointer gap-2 rounded-xl text-xs font-bold',
											user.banned ? 'text-primary' : 'text-destructive'
										)}
										disabled={user.id === currentUserId}
										onclick={() => onBanUser(user.id, user.banned ?? false)}
									>
										{#if user.banned}
											<Unlock class="h-4 w-4" />
											Unban Account
										{:else}
											<Ban class="h-4 w-4" />
											Ban Account
										{/if}
									</DropdownMenu.Item>
									<DropdownMenu.Separator class="my-1" />
									<DropdownMenu.Item
										class="cursor-pointer gap-2 rounded-xl text-xs font-bold text-destructive"
										disabled={user.id === currentUserId}
										onclick={() => {
											requestConfirmation(
												'Delete User',
												`Are you sure you want to permanently delete user "${user.name}"? This action cannot be undone.`,
												async () => {
													// TODO: Implement deleteUser in authClient
													toast.error('Delete user not implemented yet');
													refreshUsers();
												}
											);
										}}
									>
										<UserMinus class="h-4 w-4" />
										Delete User
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</CardContent>
</Card>
