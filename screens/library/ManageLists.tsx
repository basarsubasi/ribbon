import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, Surface, IconButton, TextInput, Button, Divider, Chip, ActivityIndicator } from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LibraryStackParamList } from '../../utils/types';
import { useSQLiteContext } from 'expo-sqlite';
import { scale, verticalScale } from 'react-native-size-matters';

 type ManageListsRouteProp = RouteProp<LibraryStackParamList, 'ManageLists'>;
 type ManageListsNavProp = StackNavigationProp<LibraryStackParamList, 'ManageLists'>;

const ManageLists: React.FC = () => {
  const { theme } = useTheme();
  const route = useRoute<ManageListsRouteProp>();
  const navigation = useNavigation<ManageListsNavProp>();
  const db = useSQLiteContext();
  const { type } = route.params;

  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());

  const titleMap: Record<typeof type, string> = {
    authors: 'Authors',
    categories: 'Categories',
    publishers: 'Publishers'
  } as const;

  const tableMap = {
    authors: { table: 'authors', column: 'name' },
    categories: { table: 'categories', column: 'name' },
    publishers: { table: 'publishers', column: 'name' },
  } as const;

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { table, column } = tableMap[type];
      const rows = await db.getAllAsync<any>(`SELECT ${column} as value FROM ${table} ORDER BY ${column}`);
      setItems(rows.map(r => r.value));
    } catch (e) {
      console.warn('Failed loading list', e);
    } finally {
      setLoading(false);
    }
  }, [db, type]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleAdd = () => {
    const v = newValue.trim();
    if (!v) return;
    if (items.includes(v)) { Alert.alert('Duplicate', 'Already exists'); return; }
    setItems(prev => [...prev, v]);
    setAdded(prev => new Set(prev).add(v));
    setNewValue('');
  };

  const toggleDelete = (val: string) => {
    setDeleted(prev => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val); else next.add(val);
      return next;
    });
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const { table, column } = tableMap[type];
      // Deletes
      for (const d of deleted) {
        await db.runAsync(`DELETE FROM ${table} WHERE ${column} = ?`, [d]);
      }
      // Inserts
      for (const a of added) {
        if (!deleted.has(a)) {
          await db.runAsync(`INSERT OR IGNORE INTO ${table} (${column}) VALUES (?)`, [a]);
        }
      }
      navigation.navigate("Library");
      
    } catch (e) {
      console.error('Save failed', e);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>      
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.headerRow}>
          <Text variant="titleLarge" style={[styles.headerTitle, { color: theme.colors.onSurface, textAlign: 'left' }]}>{titleMap[type]}</Text>
          <View style={{ width: scale(40) }} />
        </View>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'left' }}>
          Add new, or tap items to mark for deletion.
        </Text>
      </Surface>

      <Surface style={[styles.body, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.addRow}>
          <TextInput
            mode="outlined"
            value={newValue}
            onChangeText={setNewValue}
            placeholder={`New ${titleMap[type].slice(0, -1)}`}
            style={styles.input}
          />
          <Button mode="contained" onPress={handleAdd} disabled={!newValue.trim()}>Add</Button>
        </View>
        <Divider style={{ marginVertical: verticalScale(12) }} />
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isDeleted = deleted.has(item);
              return (
                <Chip
                  onPress={() => toggleDelete(item)}
                  style={[
                    styles.chip,
                    isDeleted && { backgroundColor: theme.colors.errorContainer },
                  ]}
                  textStyle={{ color: isDeleted ? theme.colors.onErrorContainer : theme.colors.onSurface }}
                >
                  {item}{isDeleted ? ' (delete)' : ''}
                </Chip>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: verticalScale(6) }} />}
            ListEmptyComponent={() => (
              <Text style={{ color: theme.colors.onSurfaceVariant }}>No entries</Text>
            )}
          />
        )}
        <Button
          mode="contained"
          onPress={saveChanges}
          disabled={saving || (added.size === 0 && deleted.size === 0)}
          style={{ marginTop: verticalScale(16) }}
          labelStyle={{ color: "#FFFFFF" }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: scale(16), margin: scale(16), borderRadius: scale(12) },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(4) },
  headerTitle: { fontWeight: '600', flex: 1, textAlign: 'center' },
  body: { flex: 1, marginHorizontal: scale(16), marginBottom: scale(16), padding: scale(16), borderRadius: scale(12) },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  input: { flex: 1 },
  chip: { alignSelf: 'flex-start' },
});

export default ManageLists;
