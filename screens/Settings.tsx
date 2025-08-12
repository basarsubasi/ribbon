import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  Menu, 
  Divider,
  ActivityIndicator,
  useTheme,
  Surface,
  IconButton
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useSettings } from '../context/SettingsContext';
import { reCacheBookCovers } from '../utils/coverCacheUtil';
import { exportDatabase, importDatabase } from '../utils/backupUtil';
import SettingsIcon from '../components/SettingsIcon';
import { useTheme as useThemeContext } from '../context/ThemeContext';

export default function Settings() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { language, setLanguage, dateFormat, setDateFormat, theme: appTheme, setTheme } = useSettings();
  const { setMode } = useThemeContext();

  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  // Date format now uses a toggle instead of menu
  // Removed theme menu; using toggle switch instead
  const [isRecaching, setIsRecaching] = useState(false);

  const handleReCacheCovers = async () => {
    setIsRecaching(true);
    try {
      const result = await reCacheBookCovers();
      
      if (result.success) {
        const message = result.updatedCount === 0 
          ? 'No books with HTTP cover URLs found to cache.'
          : `Successfully cached ${result.updatedCount} book covers.${result.errorCount > 0 ? ` ${result.errorCount} failed.` : ''}`;
        
        Alert.alert(
          'Cover Re-caching Complete',
          message,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Re-caching Failed',
          'Failed to re-cache book covers. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error re-caching covers:', error);
      Alert.alert(
        'Re-caching Failed',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    }
    setIsRecaching(false);
  };

  const handleGitHubPress = () => {
    Linking.openURL('https://github.com/basarsubasi/ribbon');
  };

  const getLanguageDisplayName = (lang: string) => {
    switch (lang) {
      case 'en': return 'English';
     // case 'tr': return 'Türkçe';
      default: return lang;
    }
  };



  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Surface style={[styles.header, { backgroundColor: theme.colors.background }]} elevation={0}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <SettingsIcon 
                width={scale(40)} 
                height={scale(40)} 
                primaryColor={theme.colors.primary}
                secondaryColor={theme.colors.primaryContainer}
                accentColor={theme.colors.primary}
              />
              <Text variant="headlineLarge" style={[styles.appName, { color: theme.colors.primary }]}>
                {t('settings.title')}
              </Text>
            </View>
          </View>
        </Surface>

        <View style={styles.content}>
          {/* Preferences Section */}
          <View style={styles.section}>
            <Text style={[styles.categoryTitle, { color: theme.colors.onBackground }]}>
              <Ionicons name="options-outline" size={scale(18)} /> Preferences
            </Text>
            
            {/* Language Card */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeader}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="language" size={scale(20)} color={theme.colors.primary} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>
                      {t('settings.language')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>
                      Choose your preferred language
                    </Text>
                  </View>
                </View>
                <Menu
                  visible={languageMenuVisible}
                  onDismiss={() => setLanguageMenuVisible(false)}
                  anchor={
                    <Button
                      mode="contained"
                      onPress={() => setLanguageMenuVisible(true)}
                      style={styles.selectButton}
                      contentStyle={styles.buttonContent}
                    >
                      <View style={styles.buttonInner}>
                        <Text style={[styles.buttonLabel, styles.buttonLabelInverse]}>{getLanguageDisplayName(language)}</Text>
                      </View>
                    </Button>
                  }
                >
                  <Menu.Item 
                    onPress={() => {
                      setLanguage('en');
                      setLanguageMenuVisible(false);
                    }} 
                    title="English"
                    leadingIcon="translate"
                  />
                </Menu>
              </Card.Content>
            </Card>

            {/* Date Format Card (Toggle) */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeaderToggle}>
                  <View style={styles.settingHeaderLeft}>
                    <View style={styles.settingIcon}>
                      <Ionicons name="calendar-outline" size={scale(20)} color={theme.colors.primary} />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>
                        {t('settings.dateFormat')}
                      </Text>
                      <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>Toggle date ordering</Text>
                    </View>
                  </View>
                  <View style={styles.toggleWrapper}>
                    <Text style={[styles.toggleSideLabel, { color: dateFormat === 'dd-mm-yyyy' ? theme.colors.primary : theme.colors.onSurface }]}>DD-MM</Text>
                    <View
                      style={[styles.toggleTrack, { backgroundColor: theme.colors.primary }]}
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          dateFormat === 'mm-dd-yyyy' ? styles.toggleThumbOn : styles.toggleThumbOff,
                        ]}
                      />
                      <View
                        onStartShouldSetResponder={() => true}
                        onResponderRelease={() => {
                          const next = dateFormat === 'dd-mm-yyyy' ? 'mm-dd-yyyy' : 'dd-mm-yyyy';
                          setDateFormat(next);
                        }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                    <Text style={[styles.toggleSideLabel, { color: dateFormat === 'mm-dd-yyyy' ? theme.colors.primary : theme.colors.onSurface }]}>MM-DD</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Theme Card (Toggle) */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeaderToggle}> 
                  <View style={styles.settingHeaderLeft}>
                    <View style={styles.settingIcon}>
                      <Ionicons 
                        name={appTheme === 'dark' ? "moon" : "sunny"} 
                        size={scale(20)} 
                        color={theme.colors.primary} 
                      />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}> {t('settings.theme')} </Text>
                      <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>Toggle light / dark mode</Text>
                    </View>
                  </View>
                  <View style={styles.toggleWrapper}>
                    <View style={styles.toggleSide}> 
                      <Ionicons name="sunny" size={scale(14)} color={appTheme === 'light' ? theme.colors.primary : theme.colors.onSurface} />
                    </View>
                    <View
                      style={[styles.toggleTrack, { backgroundColor: theme.colors.primary }]}
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          appTheme === 'dark' ? styles.toggleThumbOn : styles.toggleThumbOff,
                        ]}
                      />
                      <View
                        onStartShouldSetResponder={() => true}
                        onResponderRelease={() => {
                          const next = appTheme === 'light' ? 'dark' : 'light';
                          setTheme(next);
                          setMode(next);
                        }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                    <View style={styles.toggleSide}>
                      <Ionicons name="moon" size={scale(14)} color={appTheme === 'dark' ? theme.colors.primary : theme.colors.onSurface} />
                    </View>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>

          {/* Data Management Section */}
          <View style={styles.section}>
            <Text style={[styles.categoryTitle, { color: theme.colors.onBackground }]}>
              <Ionicons name="server-outline" size={scale(18)} /> Data Management
            </Text>
            
            {/* Book Covers Card */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeader}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="images-outline" size={scale(20)} color={theme.colors.primary} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>
                      {t('settings.bookCovers')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>
                      Re-download and cache book covers from Open Library
                    </Text>
                  </View>
                </View>
                <Button
                  mode="contained"
                  onPress={handleReCacheCovers}
                  disabled={isRecaching}
                  style={styles.actionButton}
                  contentStyle={styles.buttonContent}
                >
                  <View style={styles.buttonInner}>
                    {isRecaching ? (
                      <>
                        <ActivityIndicator size="small" color="white" style={styles.leadingSpinner} />
                        <Text style={[styles.buttonLabel, styles.buttonLabelInverse]}>{t('settings.reCachingCovers')}</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="refresh" size={scale(18)} color="white" style={styles.leadingIcon} />
                        <Text style={[styles.buttonLabel, styles.buttonLabelInverse]}>{t('settings.reCacheCovers')}</Text>
                      </>
                    )}
                  </View>
                </Button>
              </Card.Content>
            </Card>

            {/* Database Backup Card */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeader}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="archive-outline" size={scale(20)} color={theme.colors.primary} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>
                      {t('settings.databaseManagement')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>
                      Backup and restore your reading data
                    </Text>
                  </View>
                </View>
                <View style={styles.buttonRow}>
                  <Button
                    mode="contained"
                    onPress={() => exportDatabase(dateFormat, t)}
                    style={[styles.actionButton, styles.halfButton]}
                    contentStyle={styles.buttonContent}
                  >
                    <View style={styles.buttonInner}>
                      <Ionicons name="share-outline" size={scale(16)} color="#FFFFFF" style={styles.leadingIcon} />
                      <Text style={[styles.buttonLabel, styles.buttonLabelInverse]}>{t('settings.export')}</Text>
                    </View>
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => importDatabase(t)}
                    style={[styles.actionButton, styles.halfButton]}
                    contentStyle={styles.buttonContent}
                  >
                    <View style={styles.buttonInner}>
                      <Ionicons name="download-outline" size={scale(16)} color="#FFFFFF" style={styles.leadingIcon} />
                      <Text style={[styles.buttonLabel, styles.buttonLabelInverse]}>{t('settings.import')}</Text>
                    </View>
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={[styles.categoryTitle, { color: theme.colors.onBackground }]}>
              <Ionicons name="information-circle-outline" size={scale(18)} /> About
            </Text>
            
            {/* Source Code Card */}
            <Card style={[styles.settingCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.settingHeader}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="code-slash" size={scale(20)} color={theme.colors.primary} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.onSurface }]}>
                      {t('settings.sourceCode')}
                    </Text>
                    <Text style={[styles.settingDescription, { color: theme.colors.onSurface, opacity: 0.6 }]}>
                      View the source code on GitHub
                    </Text>
                  </View>
                </View>
                <Button
                  mode="contained"
                  onPress={handleGitHubPress}
                  style={styles.actionButton}
                  contentStyle={styles.buttonContent}
                >
                  <View style={styles.buttonInner}>
                    <Ionicons name="logo-github" size={scale(18)} color="#FFFFFF" style={styles.leadingIcon} />
                    <Text style={[styles.buttonLabel, styles.buttonLabelInverse]}>GitHub</Text>
                  </View>
                </Button>
              </Card.Content>
            </Card>
          </View>
        </View>

        <View style={{ height: verticalScale(30) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(24),
    marginBottom: verticalScale(8),
  },
  headerContent: {
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  appName: {
    marginLeft: scale(12),
    fontWeight: '300',
    letterSpacing: moderateScale(2),
    textTransform: 'lowercase',
  },
  tagline: {
    opacity: 0.7,
  },
  content: {
    paddingHorizontal: scale(16),
    marginTop: verticalScale(8),
  },
  section: {
    marginBottom: verticalScale(24),
  },
  categoryTitle: {
    fontSize: scale(20),
    fontWeight: '600',
    marginBottom: verticalScale(16),
    paddingHorizontal: scale(4),
  },
  settingCard: {
    marginBottom: verticalScale(12),
    borderRadius: scale(16),
  },
  cardContent: {
    paddingVertical: verticalScale(16),
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  settingHeaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(4),
  },
  settingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: scale(12),
  },
  toggleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleSide: {
    width: scale(42),
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTrack: {
    width: scale(70),
    height: verticalScale(30),
    borderRadius: verticalScale(30) / 2,
    marginHorizontal: scale(4),
    padding: scale(4),
    justifyContent: 'center',
  },
  toggleThumb: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
  },
  toggleThumbOn: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-end',
  },
  toggleThumbOff: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleLabel: {
    fontSize: scale(11),
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  toggleSideLabel: {
    fontSize: scale(11),
    fontWeight: '600',
    letterSpacing: 0.5,
    minWidth: scale(42),
    textAlign: 'center',
  },
  settingIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(128, 201, 160, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: scale(16),
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: scale(12),
    marginTop: verticalScale(2),
  },
  selectButton: {
    marginTop: verticalScale(4),
  },
  actionButton: {
    marginTop: verticalScale(4),
    borderRadius: scale(12),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(8),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(8),
    marginTop: verticalScale(4),
  },
  halfButton: {
    flex: 1,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingIcon: {
    marginRight: scale(6),
  },
  leadingSpinner: {
    marginRight: scale(8),
  },
  trailingIcon: {
    marginLeft: scale(6),
  },
  buttonLabel: {
    fontSize: scale(14),
    fontWeight: '500',
  },
  buttonLabelInverse: {
    color: 'white',
  },
});