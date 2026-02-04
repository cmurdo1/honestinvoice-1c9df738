import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, Search } from 'lucide-react';
import { format } from 'date-fns';

interface UserRow {
  id: string;
  email: string;
  business_name: string | null;
  subscription_status: string | null;
  subscription_end: string | null;
  created_at: string;
  invoice_count: number;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase.rpc('get_all_users');
      if (!error && data) {
        setUsers(data as UserRow[]);
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.business_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Canceled</Badge>;
      default:
        return <Badge variant="outline">Free</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Management
        </CardTitle>
        <CardDescription>View and search all registered users</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or business name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.business_name || '—'}</TableCell>
                      <TableCell>{getStatusBadge(user.subscription_status)}</TableCell>
                      <TableCell className="text-right">{user.invoice_count}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      </CardContent>
    </Card>
  );
}
